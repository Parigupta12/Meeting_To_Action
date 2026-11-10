import { addDays, formatDate, parseIso, startOfDay, toIsoDate } from "./dates";
import type { CommandPlan, Task, TaskChange, TaskStatus } from "./types";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To Do",
  doing: "Doing",
  done: "Done",
};
const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "task", "mark", "move", "set", "make", "has",
  "have", "had", "was", "were", "now", "please", "from", "into", "about", "its", "his", "her",
  "their", "our", "new", "one", "all", "both",
]);
const NOT_A_NAME = new Set([
  "the", "next", "this", "today", "tomorrow", "monday", "tuesday", "wednesday", "thursday",
  "friday", "saturday", "sunday", "done", "doing", "todo", "end", "me", "them", "him", "her",
]);

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function words(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Understands "Friday", "next week", "tomorrow", "Nov 12", "in 3 days", "2026-11-12". */
export function parseDateWords(text: string, todayIso: string): string | null {
  const t = text.toLowerCase();
  const today = startOfDay(parseIso(todayIso));
  const iso = (d: Date) => toIsoDate(d);

  const direct = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (direct) return direct[1];
  if (/\btoday\b/.test(t)) return iso(today);
  if (/\btomorrow\b/.test(t)) return iso(addDays(today, 1));
  const inDays = t.match(/\bin (\d{1,2}) days?\b/);
  if (inDays) return iso(addDays(today, Number(inDays[1])));
  if (/\bnext week\b/.test(t)) {
    let d = addDays(today, 1);
    while (d.getDay() !== 1) d = addDays(d, 1);
    return iso(d);
  }
  const monthDay = t.match(
    new RegExp(`\\b(${MONTHS.join("|")})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`),
  );
  if (monthDay) {
    const month = MONTHS.indexOf(monthDay[1]);
    let d = new Date(today.getFullYear(), month, Number(monthDay[2]));
    if (d < today) d = new Date(today.getFullYear() + 1, month, Number(monthDay[2]));
    return iso(d);
  }
  const weekday = t.match(new RegExp(`\\b(next\\s+)?(${WEEKDAYS.join("|")})\\b`));
  if (weekday) {
    const target = WEEKDAYS.indexOf(weekday[2]);
    if (weekday[1]) {
      // "next Friday" = that day in next calendar week (weeks run Monday to Sunday).
      const toNextMonday = ((8 - today.getDay()) % 7) || 7;
      const offset = (target + 6) % 7; // Monday = 0
      return iso(addDays(today, toNextMonday + offset));
    }
    let days = (target - today.getDay() + 7) % 7;
    if (days === 0) days = 7;
    return iso(addDays(today, days));
  }
  if (/\bend of (the )?week\b/.test(t)) {
    const days = (5 - today.getDay() + 7) % 7;
    return iso(addDays(today, days));
  }
  return null;
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function knownOwners(tasks: Task[]) {
  return [...new Set(tasks.map((t) => t.owner).filter((o) => o && o !== "Unassigned"))];
}

function findOwnerIn(command: string, tasks: Task[]) {
  const lower = command.toLowerCase();
  return knownOwners(tasks).find((o) => new RegExp(`\\b${o.toLowerCase()}('s)?\\b`).test(lower));
}

function scoreTask(command: string, task: Task) {
  const cmd = new Set(words(command));
  const cmdStems = new Set([...cmd].map((w) => w.slice(0, 4)));
  const taskWords = words(task.task);
  const hits = taskWords.filter((w) => cmd.has(w) || cmdStems.has(w.slice(0, 4))).length;
  let score = hits + (taskWords.length ? (hits / taskWords.length) * 0.5 : 0);
  const owner = task.owner.toLowerCase();
  if (owner && owner !== "unassigned" && new RegExp(`\\b${owner}\\b`).test(command.toLowerCase())) {
    score += 0.5;
  }
  return { hits, score };
}

function plan(interpretation: string, changes: TaskChange[], clarification?: string): CommandPlan {
  return { interpretation, changes, clarification: clarification ?? null };
}

/** Rule-based fallback so the voice box still works when Gemini is unavailable. */
export function parseCommandLocally(
  commandRaw: string,
  tasks: Task[],
  todayIso: string,
): CommandPlan {
  const command = commandRaw.trim().replace(/\s+/g, " ");
  const lower = command.toLowerCase();
  const asked = (text: string) =>
    plan(`I heard: “${command}”`, [], text);

  // ---- add a task -------------------------------------------------------
  const add = command.match(
    /^(?:please\s+)?(?:add|create|new)\s+(?:a\s+|an\s+)?(?:new\s+)?(?:task|todo|to-do|action item)?\s*[:\-]?\s*(.*)$/i,
  );
  if (add) {
    let rest = add[1].trim();
    let owner = "Unassigned";
    const resolveOwner = (name: string) =>
      knownOwners(tasks).find((o) => o.toLowerCase() === name.toLowerCase()) ??
      capitalize(name);

    const dateMatch = rest.match(/\b(?:by|due|before|on)\s+(.+)$/i);
    const deadline = dateMatch ? parseDateWords(dateMatch[1], todayIso) : null;
    if (dateMatch && deadline) rest = rest.slice(0, dateMatch.index).trim();

    const lead = rest.match(/^for\s+([A-Za-z]+)\s+(?:to\s+)?(.+)$/i);
    const trail = rest.match(/^(.+?)\s+(?:for|assign(?:ed)?\s+to)\s+([A-Za-z]+)$/i);
    if (lead && !NOT_A_NAME.has(lead[1].toLowerCase())) {
      owner = resolveOwner(lead[1]);
      rest = lead[2];
    } else if (trail && !NOT_A_NAME.has(trail[2].toLowerCase())) {
      owner = resolveOwner(trail[2]);
      rest = trail[1];
    }
    rest = rest.replace(/^(?:to|that)\s+/i, "").replace(/[.,;]+$/, "").trim();
    if (rest.length < 3) return asked("What should the new task be?");
    return plan(`Add a new task for ${owner}`, [
      { type: "add", task: capitalize(rest), owner, deadline },
    ]);
  }

  if (tasks.length === 0) return asked("There are no tasks on the board yet.");

  // ---- which task(s)? ---------------------------------------------------
  const ownerMentioned = findOwnerIn(command, tasks);
  const wantsAll = /\b(all|both|every|everything)\b/.test(lower);
  let targets: Task[] = [];
  let tied = false;
  if (wantsAll && ownerMentioned) {
    targets = tasks.filter((t) => t.owner === ownerMentioned && t.status !== "done");
  } else {
    const ranked = tasks
      .map((task) => ({ task, ...scoreTask(command, task) }))
      .sort((a, b) => b.score - a.score);
    const [first, second] = ranked;
    // Best match wins (earliest task on a tie). The person still confirms the
    // exact task before anything changes.
    if (first && first.hits >= 1) {
      targets = [first.task];
      tied = Boolean(second && second.score === first.score);
    }
  }
  if (targets.length === 0) {
    return asked("Which task do you mean? Say part of its name or the owner.");
  }

  const changes: TaskChange[] = [];
  const label = targets.length === 1 ? `“${targets[0].task}”` : `${targets.length} tasks`;
  const note = tied ? " (closest match: check it is the right task)" : "";

  // ---- delete -----------------------------------------------------------
  if (/\b(delete|remove|cancel|drop|scrap)\b/.test(lower)) {
    for (const t of targets) changes.push({ type: "delete", taskId: t.id });
    return plan(`Delete ${label}${note}`, changes);
  }

  // ---- reassign ---------------------------------------------------------
  const assign = command.match(
    /\b(?:reassign|assign|give|hand(?:\s+it)?\s+over|transfer|pass)\b.*?\bto\s+([A-Za-z]+)/i,
  );
  if (assign && !NOT_A_NAME.has(assign[1].toLowerCase())) {
    const owner =
      knownOwners(tasks).find((o) => o.toLowerCase() === assign[1].toLowerCase()) ??
      capitalize(assign[1]);
    for (const t of targets) changes.push({ type: "reassign", taskId: t.id, owner });
    return plan(`Reassign ${label} to ${owner}${note}`, changes);
  }

  // ---- status -----------------------------------------------------------
  let status: TaskStatus | null = null;
  const moveTo = lower.match(/\bto\s+(done|doing|in progress|to ?do|to-do)\b/);
  if (moveTo) {
    status = moveTo[1].startsWith("done")
      ? "done"
      : moveTo[1].startsWith("do") && moveTo[1] !== "doing"
        ? "todo"
        : moveTo[1] === "doing" || moveTo[1] === "in progress"
          ? "doing"
          : "todo";
  } else if (/\b(done|finished|finish|completed?|shipped|wrapped up|is live|went live|delivered)\b/.test(lower)) {
    status = "done";
  } else if (/\b(started|starting|start|working on|in progress|began|kicked off)\b/.test(lower)) {
    status = "doing";
  } else if (/\b(reopen|re-open|not done|not finished|blocked|back to to ?do)\b/.test(lower)) {
    status = "todo";
  }

  // ---- reschedule -------------------------------------------------------
  const reschedWord = /\b(push|postpone|delay|reschedule|extend|shift|deadline|due date|due)\b/.test(lower);
  const deadlinePhrase = lower.match(/\b(?:to|until|till|by|for)\s+(.+)$/);
  const deadline = deadlinePhrase ? parseDateWords(deadlinePhrase[1], todayIso) : null;
  if ((reschedWord || (!status && /\bmove\b/.test(lower))) && deadline) {
    for (const t of targets) changes.push({ type: "reschedule", taskId: t.id, deadline });
    return plan(`Move the deadline of ${label} to ${formatDate(deadline)}${note}`, changes);
  }

  if (status) {
    for (const t of targets) changes.push({ type: "move", taskId: t.id, status });
    return plan(`Mark ${label} as ${STATUS_LABEL[status]}${note}`, changes);
  }

  return asked(
    `I found ${label} but not what to do. Say done, doing, a new date, or a new owner.`,
  );
}

const ISO_OK = (value: unknown): value is string =>
  typeof value === "string" && ISO.test(value);

/** Validates whatever Gemini returned so a bad answer can never corrupt the board. */
export function sanitizePlan(parsed: unknown, tasks: Task[]): CommandPlan {
  const raw =
    parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const ids = new Set(tasks.map((t) => t.id));
  const changes: TaskChange[] = [];
  const list = Array.isArray(raw.changes) ? raw.changes : [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const type = c.type;
    if (
      type !== "move" &&
      type !== "reschedule" &&
      type !== "reassign" &&
      type !== "add" &&
      type !== "delete"
    ) {
      continue;
    }
    const change: TaskChange = {
      type,
      summary: typeof c.summary === "string" ? c.summary : undefined,
    };
    if (type !== "add") {
      if (typeof c.taskId !== "string" || !ids.has(c.taskId)) continue;
      change.taskId = c.taskId;
    }
    if (type === "move") {
      if (c.status !== "todo" && c.status !== "doing" && c.status !== "done") continue;
      change.status = c.status;
    }
    if (type === "reschedule") {
      change.deadline = ISO_OK(c.deadline) ? c.deadline : null;
    }
    if (type === "reassign") {
      if (typeof c.owner !== "string" || !c.owner.trim()) continue;
      change.owner = c.owner.trim();
    }
    if (type === "add") {
      if (typeof c.task !== "string" || c.task.trim().length < 3) continue;
      change.task = c.task.trim();
      change.owner =
        typeof c.owner === "string" && c.owner.trim() ? c.owner.trim() : "Unassigned";
      change.deadline = ISO_OK(c.deadline) ? c.deadline : null;
    }
    changes.push(change);
  }

  return {
    interpretation:
      typeof raw.interpretation === "string" && raw.interpretation.trim()
        ? raw.interpretation.trim()
        : "Here is what I understood.",
    changes,
    clarification:
      typeof raw.clarification === "string" && raw.clarification.trim()
        ? raw.clarification.trim()
        : changes.length === 0
          ? "I could not match that to a task. Try naming the task or its owner."
          : null,
  };
}

export function describeChange(change: TaskChange, tasks: Task[]): string {
  const target = tasks.find((t) => t.id === change.taskId);
  const name = target ? `“${target.task}”` : "task";
  switch (change.type) {
    case "move":
      return `Move ${name} to ${STATUS_LABEL[change.status ?? "todo"]}`;
    case "reschedule":
      return change.deadline
        ? `Change the deadline of ${name} to ${formatDate(change.deadline)}`
        : `Clear the deadline of ${name}`;
    case "reassign":
      return `Reassign ${name} to ${change.owner}`;
    case "delete":
      return `Delete ${name}`;
    case "add":
      return `Add “${change.task}” for ${change.owner ?? "Unassigned"}${
        change.deadline ? `, due ${formatDate(change.deadline)}` : ""
      }`;
  }
}

export function applyChanges(
  tasks: Task[],
  changes: TaskChange[],
  command: string,
): Task[] {
  let next = [...tasks];
  const stamp = Date.now();
  changes.forEach((change, index) => {
    if (change.type === "add") {
      next.push({
        id: `voice-${stamp}-${index}`,
        task: change.task ?? "New task",
        owner: change.owner ?? "Unassigned",
        deadline: change.deadline ?? null,
        quote: command,
        status: "todo",
        meetingTitle: "Voice command",
        createdAt: new Date(stamp).toISOString(),
      });
      return;
    }
    if (change.type === "delete") {
      next = next.filter((t) => t.id !== change.taskId);
      return;
    }
    next = next.map((t) => {
      if (t.id !== change.taskId) return t;
      if (change.type === "move" && change.status) return { ...t, status: change.status };
      if (change.type === "reschedule") return { ...t, deadline: change.deadline ?? null };
      if (change.type === "reassign" && change.owner) return { ...t, owner: change.owner };
      return t;
    });
  });
  return next;
}
