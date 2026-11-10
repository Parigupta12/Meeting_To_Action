"use client";

import { formatDate, isDueSoon, isOverdue } from "@/lib/dates";
import type { Task } from "@/lib/types";

export default function RemindersPanel({ tasks }: { tasks: Task[] }) {
  const dueSoon = tasks.filter((task) => isDueSoon(task));
  const overdue = tasks.filter((task) => isOverdue(task));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Reminders
      </h2>
      <p className="mt-1 text-lg font-semibold text-slate-900">
        Due in the next 48 hours
      </p>

      {dueSoon.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Nothing due in the next 48 hours.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {dueSoon.map((task) => (
            <li
              key={task.id}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
            >
              <p className="font-medium text-amber-950">{task.task}</p>
              <p className="text-amber-800">
                {task.owner} · {formatDate(task.deadline)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5">
        <p className="text-sm font-semibold text-red-700">Overdue</p>
        {overdue.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No overdue tasks.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {overdue.map((task) => (
              <li
                key={task.id}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
              >
                <p className="font-medium">{task.task}</p>
                <p>
                  {task.owner} · was due {formatDate(task.deadline)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
