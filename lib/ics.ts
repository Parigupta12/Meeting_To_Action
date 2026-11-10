import { parseDeadline } from "./dates";
import type { Task } from "./types";

function escapeText(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\;");
}

function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function stamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** All-day events on each open task's deadline, each with a reminder one day before. */
export function buildIcs(tasks: Task[]) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MeetingToAction//EN",
    "CALSCALE:GREGORIAN",
  ];
  let count = 0;
  for (const task of tasks) {
    if (task.status === "done") continue;
    const due = parseDeadline(task.deadline);
    if (!due) continue;
    const end = new Date(due);
    end.setDate(end.getDate() + 1);
    count += 1;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(task.id)}@meetingtoaction`,
      `DTSTAMP:${stamp()}`,
      `DTSTART;VALUE=DATE:${ymd(due)}`,
      `DTEND;VALUE=DATE:${ymd(end)}`,
      `SUMMARY:${escapeText(`${task.task} (${task.owner || "Unassigned"})`)}`,
      `DESCRIPTION:${escapeText(`From meeting: ${task.meetingTitle}`)}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(`Due tomorrow: ${task.task}`)}`,
      "TRIGGER:-P1D",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return { text: lines.join("\r\n") + "\r\n", count };
}

export function downloadIcs(tasks: Task[]) {
  const { text, count } = buildIcs(tasks);
  if (count === 0) return 0;
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "meeting-tasks.ics";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return count;
}
