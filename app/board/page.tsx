"use client";

import Avatar from "@/components/Avatar";
import PageHeader from "@/components/PageHeader";
import RemindersPanel from "@/components/RemindersPanel";
import VoiceCommandPanel from "@/components/VoiceCommandPanel";
import { formatDate, isOverdue } from "@/lib/dates";
import { downloadIcs } from "@/lib/ics";
import { STORAGE_KEYS } from "@/lib/storage";
import type { Task, TaskStatus } from "@/lib/types";
import { useState } from "react";
import { useLocalStorage } from "@/lib/use-local-storage";

const columns: { id: TaskStatus; title: string; dot: string }[] = [
  { id: "todo", title: "To Do", dot: "bg-slate-400" },
  { id: "doing", title: "Doing", dot: "bg-amber-500" },
  { id: "done", title: "Done", dot: "bg-emerald-500" },
];

function nextStatus(status: TaskStatus): TaskStatus | null {
  if (status === "todo") return "doing";
  if (status === "doing") return "done";
  return null;
}

function prevStatus(status: TaskStatus): TaskStatus | null {
  if (status === "done") return "doing";
  if (status === "doing") return "todo";
  return null;
}

export default function BoardPage() {
  const tasksStore = useLocalStorage<Task[]>(STORAGE_KEYS.tasks, []);
  const flashStore = useLocalStorage<string>(STORAGE_KEYS.flash, "");
  const [calendarNote, setCalendarNote] = useState("");

  function exportCalendar() {
    const count = downloadIcs(tasksStore.value);
    setCalendarNote(
      count > 0
        ? `Downloaded ${count} deadline${count === 1 ? "" : "s"} with a reminder one day before each.`
        : "No open tasks with a deadline to export.",
    );
  }

  function move(id: string, status: TaskStatus) {
    tasksStore.setValue((prev) =>
      prev.map((task) => (task.id === id ? { ...task, status } : task)),
    );
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-8">
      <PageHeader
        eyebrow="Task board"
        title="Board"
        actions={
          <>
            <button
              type="button"
              onClick={exportCalendar}
              className="rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-indigo-900 shadow hover:bg-indigo-50"
            >
              Download calendar reminders (.ics)
            </button>
            <button
              type="button"
              onClick={() => {
                tasksStore.setValue([]);
                setCalendarNote("");
              }}
              className="rounded-xl border border-white/30 px-3.5 py-2 text-sm font-semibold hover:bg-white/10"
            >
              Clear tasks
            </button>
            {calendarNote && (
              <p role="status" className="text-sm text-indigo-100">
                {calendarNote}
              </p>
            )}
          </>
        }
      >
        <p>
          Tasks appear here only after you confirm a meeting. Move cards with the buttons, or just
          tell the agent below.
        </p>
      </PageHeader>

      {flashStore.value && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
        >
          <p>
            <span className="font-semibold">Saved. </span>
            {flashStore.value}
          </p>
          <button
            type="button"
            onClick={() => flashStore.setValue("")}
            className="text-xs font-semibold text-emerald-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <VoiceCommandPanel tasks={tasksStore.value} setTasks={(next) => tasksStore.setValue(next)} />

      <RemindersPanel tasks={tasksStore.value} />

      {!tasksStore.ready ? (
        <p className="text-sm text-slate-500">Loading board…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {columns.map((column) => {
            const items = tasksStore.value.filter((task) => task.status === column.id);
            return (
              <section
                key={column.id}
                className="rounded-2xl border border-slate-200 bg-slate-100/70 p-3"
              >
                <h3 className="flex items-center gap-2 px-2 py-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
                  <span className={`h-2.5 w-2.5 rounded-full ${column.dot}`} />
                  {column.title} · {items.length}
                </h3>
                <div className="space-y-3">
                  {items.length === 0 && (
                    <p className="px-2 py-6 text-sm text-slate-500">No tasks here.</p>
                  )}
                  {items.map((task) => {
                    const overdue = isOverdue(task);
                    const next = nextStatus(task.status);
                    const prev = prevStatus(task.status);
                    return (
                      <article
                        key={task.id}
                        className={`rounded-xl border bg-white p-4 shadow-sm ${
                          overdue ? "border-red-300" : "border-slate-200"
                        }`}
                      >
                        <p className="font-medium text-slate-900">{task.task}</p>
                        <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                          <Avatar name={task.owner} size="sm" />
                          {task.owner}
                        </p>
                        <p
                          className={`mt-1 text-sm ${overdue ? "font-semibold text-red-700" : "text-slate-500"}`}
                        >
                          {formatDate(task.deadline)}
                          {overdue ? " · overdue" : ""}
                        </p>
                        {task.note && (
                          <p className="mt-2 rounded-md bg-sky-50 px-2 py-1 text-xs text-sky-900">
                            ↻ {task.note}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-slate-400">{task.meetingTitle}</p>
                        <div className="mt-3 flex gap-2">
                          {prev && (
                            <button
                              type="button"
                              onClick={() => move(task.id, prev)}
                              className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50"
                            >
                              Move left
                            </button>
                          )}
                          {next && (
                            <button
                              type="button"
                              onClick={() => move(task.id, next)}
                              className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50"
                            >
                              Move right
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
