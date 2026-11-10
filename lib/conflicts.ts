import type { ActionItem, Conflict, StoredDecision } from "./types";

export type Resolution = "supersede" | "keep" | "reject";

function norm(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Loose text match: equal, or the shorter one (12+ chars) is contained in the longer. */
export function sameText(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 12 && long.includes(short);
}

function tokens(text: string) {
  return new Set(norm(text).split(" ").filter((w) => w.length > 2));
}

/** 0..1 word overlap, so a reworded decision still matches the stored one. */
export function similarity(a: string, b: string) {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.size || !y.size) return 0;
  const stems = new Set([...y].map((w) => w.slice(0, 4)));
  let shared = 0;
  x.forEach((word) => {
    if (y.has(word) || stems.has(word.slice(0, 4))) shared += 1;
  });
  return shared / Math.min(x.size, y.size);
}

export function bestMatch<T>(
  items: T[],
  text: string,
  getText: (item: T) => string,
  threshold = 0.5,
): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const item of items) {
    const score = sameText(getText(item), text) ? 1 : similarity(getText(item), text);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore >= threshold ? best : null;
}

/** Marks earlier decisions as superseded for every conflict the user resolved with "supersede". */
export function applySupersedes(
  stored: StoredDecision[],
  conflicts: Conflict[],
  resolutions: Record<number, Resolution>,
  date: string,
): { next: StoredDecision[]; changed: number } {
  const marks = new Map<string, Conflict>();
  conflicts.forEach((conflict, index) => {
    if (resolutions[index] !== "supersede") return;
    const active = stored.filter((d) => !d.supersededBy && !marks.has(d.id));
    const hit = bestMatch(active, conflict.earlierDecision, (d) => d.text, 0.4);
    if (hit) marks.set(hit.id, conflict);
    for (const d of active) {
      if (marks.has(d.id)) continue;
      const echoesReplaced = hit ? isDuplicateDecision(d.text, hit.text) : false;
      const disagreesWithNew =
        sameTopic(d.text, conflict.newDecision) && !sameFacts(d.text, conflict.newDecision);
      if (echoesReplaced || disagreesWithNew) marks.set(d.id, conflict);
    }
  });
  const next = stored.map((decision) => {
    const conflict = marks.get(decision.id);
    return conflict && !decision.supersededBy
      ? { ...decision, supersededBy: conflict.newDecision, supersededOn: date }
      : decision;
  });
  return { next, changed: marks.size };
}

export type Clarification = {
  id: string;
  question: string;
  missingOwner: boolean;
  missingDeadline: boolean;
};

const NO_OWNER = /^(unassigned|unknown|tbd|n\/a|none|someone|nobody|\?)?$/i;

/** Finds action items that have no real owner or no deadline and suggests a follow-up question. */
export function findClarifications(
  actions: Pick<ActionItem, "id" | "task" | "owner" | "deadline">[],
): Clarification[] {
  const found: Clarification[] = [];
  for (const item of actions) {
    const missingOwner = NO_OWNER.test((item.owner ?? "").trim());
    const missingDeadline = !item.deadline;
    if (!missingOwner && !missingDeadline) continue;
    const question =
      missingOwner && missingDeadline
        ? `Who owns "${item.task}", and by when should it be done?`
        : missingOwner
          ? `Who owns "${item.task}"?`
          : `By when should "${item.task}" be done?`;
    found.push({ id: item.id, question, missingOwner, missingDeadline });
  }
  return found;
}

// ---------------------------------------------------------------------------
// Deterministic memory check: a second layer behind Gemini's conflict detection.
// ---------------------------------------------------------------------------

const MONTH_RE =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi;

/** The "facts" of a decision: numbers (50k = 50,000) and months. Years are ignored. */
export function decisionFacts(text: string): string[] {
  const facts = new Set<string>();
  const lower = text.toLowerCase();
  for (const m of lower.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(k|m)?(?:st|nd|rd|th)?\b/g)) {
    let n = Number(m[1].replace(/,/g, ""));
    if (Number.isNaN(n)) continue;
    if (m[2] === "k") n *= 1000;
    if (m[2] === "m") n *= 1_000_000;
    if (n >= 2000 && n <= 2100 && !m[2]) continue; // a year
    facts.add(String(n));
  }
  for (const m of lower.matchAll(MONTH_RE)) facts.add(m[1].slice(0, 3));
  return [...facts].sort();
}

const FILLER_WORDS =
  /\b(set|raise|raised|raising|increase|increased|change|changed|move|moved|reschedule|rescheduled|lock|locked|new|final|to|the|for|of|by|is|be)\b/gi;

function topicWords(text: string) {
  return text
    .replace(MONTH_RE, " ")
    .replace(/[\d$,.%]+(?:st|nd|rd|th|k|m)?/gi, " ")
    .replace(/\bcapped\b/gi, "cap")
    .replace(FILLER_WORDS, " ");
}

export function sameTopic(a: string, b: string) {
  return similarity(topicWords(a), topicWords(b)) >= 0.6;
}

export function sameFacts(a: string, b: string) {
  const x = decisionFacts(a);
  const y = decisionFacts(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

/** Same subject and same numbers/dates, even if worded differently. */
export function isDuplicateDecision(a: string, b: string) {
  return sameText(a, b) || (sameTopic(a, b) && sameFacts(a, b));
}

/**
 * Finds new decisions that talk about the same thing as an active stored decision
 * but with different numbers or dates, and that Gemini did not already flag.
 */
export function findLocalConflicts(
  newDecisions: { text: string }[],
  active: StoredDecision[],
  already: Conflict[],
): Conflict[] {
  const found: Conflict[] = [];
  for (const decision of newDecisions) {
    const covered = already.some(
      (c) => isDuplicateDecision(c.newDecision, decision.text) || similarity(c.newDecision, decision.text) >= 0.7,
    );
    if (covered) continue;
    // An identical decision is already remembered: nothing contradicts anything.
    if (active.some((a) => isDuplicateDecision(a.text, decision.text))) continue;
    const earlier = active.find((a) => sameTopic(a.text, decision.text) && !sameFacts(a.text, decision.text));
    if (!earlier) continue;
    if (found.some((c) => c.earlierDecision === earlier.text)) continue;
    found.push({
      newDecision: decision.text,
      earlierDecision: earlier.text,
      earlierMeeting: earlier.meetingTitle,
      explanation:
        "This covers the same subject as an earlier decision but with a different number or date, so the team should confirm which one stands.",
      severity: "medium",
      source: "memory-check",
    });
  }
  return found;
}

export function tidyMemory(stored: StoredDecision[], date: string) {
  const next = stored.map((d) => ({ ...d }));
  const newestFirst = next.map((_, i) => i).filter((i) => !next[i].supersededBy).reverse();
  const kept: number[] = [];
  const removed = new Set<number>();
  let superseded = 0;
  let merged = 0;
  for (const i of newestFirst) {
    const d = next[i];
    if (kept.some((k) => isDuplicateDecision(next[k].text, d.text))) {
      removed.add(i);
      merged += 1;
      continue;
    }
    const newer = kept.find((k) => sameTopic(next[k].text, d.text) && !sameFacts(next[k].text, d.text));
    if (newer !== undefined) {
      d.supersededBy = next[newer].text;
      d.supersededOn = date;
      superseded += 1;
      continue;
    }
    kept.push(i);
  }
  return { next: next.filter((_, i) => !removed.has(i)), superseded, merged };
}
