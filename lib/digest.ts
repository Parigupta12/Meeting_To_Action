import { formatDate, isDueWithinDays, isOverdue } from "./dates";
import { pickDisplayName } from "./owners";
import type { Digest, StoredDecision, Task } from "./types";

export type PersonFacts = {
  person: string;
  open: Task[];
  done: Task[];
  overdue: Task[];
  dueSoon: string[];
  decisions: string[];
};

const clean = (text: string) => text.replace(/[.\s]+$/, "");
const ownerOf = (item: { owner?: string }) => item.owner?.trim() || "Unassigned";
const ownerKey = (item: { owner?: string }) => ownerOf(item).toLowerCase();

/** Everything the digest says is computed from real data, never from a model's memory. */
export function buildPersonFacts(
  tasks: Task[],
  decisions: StoredDecision[],
  now = new Date(),
): PersonFacts[] {
  const active = decisions.filter((d) => !d.supersededBy);
  // One person per name, however it was capitalised ("jordan" and "Jordan" are the same).
  const spellings = new Map<string, string[]>();
  [...tasks, ...active].forEach((item) => {
    const list = spellings.get(ownerKey(item)) ?? [];
    list.push(ownerOf(item));
    spellings.set(ownerKey(item), list);
  });
  const people = new Map<string, string>(
    [...spellings].map(([key, names]) => [key, pickDisplayName(names)]),
  );

  return [...people]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([key, person]) => {
      const mine = tasks.filter((t) => ownerKey(t) === key);
      const open = mine.filter((t) => t.status !== "done");
      const overdue = open.filter((t) => isOverdue(t, now));
      const dueSoon = open
        .filter((t) => isDueWithinDays(t, 7, now))
        .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))
        .map(
          (t) =>
            `${clean(t.task)} (${formatDate(t.deadline)})${isOverdue(t, now) ? " · overdue" : ""}`,
        );
      return {
        person,
        open,
        done: mine.filter((t) => t.status === "done"),
        overdue,
        dueSoon,
        decisions: active.filter((d) => ownerKey(d) === key).map((d) => d.text),
      };
    });
}

export function localSummary(f: PersonFacts): string {
  const n = f.open.length;
  const parts: string[] = [
    n === 0
      ? `${f.person} has no open tasks.`
      : `${f.person} has ${n} open ${n === 1 ? "task" : "tasks"}.`,
  ];
  if (f.overdue.length > 0) {
    parts.push(
      `${f.overdue.length} ${f.overdue.length === 1 ? "is" : "are"} overdue: ${f.overdue
        .map((t) => clean(t.task))
        .join(", ")}.`,
    );
  } else {
    const next = f.open
      .filter((t) => t.deadline)
      .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))[0];
    if (next) parts.push(`Next due: ${clean(next.task)} on ${formatDate(next.deadline)}.`);
  }
  if (f.done.length > 0) parts.push(`${f.done.length} completed.`);
  if (f.decisions.length > 0) {
    parts.push(
      `Owns ${f.decisions.length} active ${f.decisions.length === 1 ? "decision" : "decisions"}.`,
    );
  }
  return parts.join(" ");
}

export function buildLocalDigest(
  tasks: Task[],
  decisions: StoredDecision[],
  now = new Date(),
): Digest[] {
  return buildPersonFacts(tasks, decisions, now).map((f) => ({
    person: f.person,
    summary: localSummary(f),
    dueSoon: f.dueSoon,
    decisionsAffectingYou: f.decisions,
  }));
}

/**
 * A model-written summary is accepted only if it agrees with the facts.
 * (Earlier it claimed a task was "completed" that was still overdue.)
 */
export function summaryIsFaithful(summary: unknown, f: PersonFacts): summary is string {
  if (typeof summary !== "string") return false;
  const text = summary.trim();
  if (text.length < 15 || text.length > 500) return false;
  if (f.done.length === 0 && /\b(complet\w*|finish\w*|done|shipped|delivered)\b/i.test(text)) {
    return false;
  }
  if (f.open.length > 0 && /\bno (open|pending|active|outstanding|remaining)\b/i.test(text)) {
    return false;
  }
  if (f.overdue.length > 0 && !/\b(overdue|past due|late|behind)\b/i.test(text)) return false;
  if (f.overdue.length === 0 && /\boverdue\b/i.test(text)) return false;
  return true;
}
