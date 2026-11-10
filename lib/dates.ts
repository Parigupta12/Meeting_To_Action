import type { Task } from "./types";

const MS_HOUR = 60 * 60 * 1000;

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nextMondayOnOrAfter(from = new Date()) {
  const start = startOfDay(from);
  const day = start.getDay();
  const add = day === 1 ? 0 : (8 - day) % 7;
  const next = new Date(start);
  next.setDate(start.getDate() + add);
  return next;
}

export function parseDeadline(deadline: string | null) {
  if (!deadline) return null;
  const parsed = new Date(`${deadline}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(deadline: string | null) {
  const parsed = parseDeadline(deadline);
  if (!parsed) return "No date";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function isOverdue(task: Task, now = new Date()) {
  if (task.status === "done") return false;
  const deadline = parseDeadline(task.deadline);
  if (!deadline) return false;
  return deadline < startOfDay(now);
}

export function isDueWithinDays(task: Task, days: number, now = new Date()) {
  if (task.status === "done") return false;
  const deadline = parseDeadline(task.deadline);
  if (!deadline) return false;
  const start = startOfDay(now).getTime();
  const due = deadline.getTime();
  if (due < start) return true;
  return due <= start + days * 24 * MS_HOUR;
}

export function isDueSoon(task: Task, now = new Date()) {
  if (task.status === "done") return false;
  const deadline = parseDeadline(task.deadline);
  if (!deadline) return false;
  const start = startOfDay(now).getTime();
  const due = deadline.getTime();
  const windowEnd = start + 48 * MS_HOUR;
  return due >= start && due <= windowEnd;
}

export function parseIso(iso: string) {
  const parsed = new Date(`${iso}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? startOfDay(new Date()) : parsed;
}

export function addDays(from: Date, days: number) {
  const next = startOfDay(from);
  next.setDate(next.getDate() + days);
  return next;
}

/** The next Monday strictly after `from`. */
export function nextMondayAfter(from: Date) {
  let next = addDays(from, 1);
  while (next.getDay() !== 1) next = addDays(next, 1);
  return next;
}
