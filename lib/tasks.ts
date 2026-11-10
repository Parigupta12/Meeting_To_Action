import { formatDate } from "./dates";
import type { ActionItem, Task } from "./types";

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "about", "from", "into", "our", "its", "their",
  "keep", "make", "get", "please", "task", "new", "now", "all", "any", "has", "have", "will",
]);

function tokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function isUnassigned(owner: string) {
  const o = owner.trim().toLowerCase();
  return !o || o === "unassigned" || o === "unknown" || o === "tbd";
}

function sameOwner(a: string, b: string) {
  return isUnassigned(a) || isUnassigned(b) || a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Needs 2+ shared words (or a near-identical short title) so "Review pricing" never matches "Review budget deck". */
function taskSimilarity(a: string, b: string) {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.length || !y.length) return { score: 0, shared: 0 };
  const yStems = new Set(y.map((w) => w.slice(0, 4)));
  const shared = x.filter((w) => yStems.has(w.slice(0, 4))).length;
  return { score: shared / Math.min(x.length, y.length), shared };
}

/** An open task on the board that this action item probably refers to. */
export function findSimilarTask(
  item: Pick<ActionItem, "task" | "owner">,
  tasks: Task[],
): Task | null {
  let best: Task | null = null;
  let bestScore = 0;
  for (const task of tasks) {
    if (task.status === "done") continue;
    if (!sameOwner(task.owner, item.owner)) continue;
    const { score, shared } = taskSimilarity(item.task, task.task);
    const good = (shared >= 2 && score >= 0.5) || score >= 0.8;
    if (good && score > bestScore) {
      best = task;
      bestScore = score;
    }
  }
  return best;
}

export type TaskUpdate = { changed: boolean; task: Task; summary: string };

/** What happens to an existing task when a later meeting restates it. */
export function planTaskUpdate(
  existing: Task,
  item: Pick<ActionItem, "owner" | "deadline">,
  meetingTitle: string,
): TaskUpdate {
  const deadlineChanged = Boolean(item.deadline) && item.deadline !== existing.deadline;
  const ownerChanged =
    !isUnassigned(item.owner) && item.owner.trim().toLowerCase() !== existing.owner.trim().toLowerCase();
  if (!deadlineChanged && !ownerChanged) {
    return { changed: false, task: existing, summary: "same owner and date" };
  }
  const notes: string[] = [];
  const parts: string[] = [];
  let next: Task = { ...existing };
  if (deadlineChanged) {
    notes.push(
      existing.deadline
        ? `Deadline ${formatDate(existing.deadline)} → ${formatDate(item.deadline)}`
        : `Deadline set to ${formatDate(item.deadline)}`,
    );
    parts.push(`the deadline to ${formatDate(item.deadline)}`);
    next = { ...next, deadline: item.deadline };
  }
  if (ownerChanged) {
    notes.push(`Owner ${existing.owner} → ${item.owner}`);
    parts.push(`the owner to ${item.owner}`);
    next = { ...next, owner: item.owner };
  }
  next.note = `${notes.join(", ")} (${meetingTitle})`;
  return { changed: true, task: next, summary: `change ${parts.join(" and ")}` };
}
