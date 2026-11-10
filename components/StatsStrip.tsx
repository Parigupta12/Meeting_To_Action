"use client";

import { isOverdue } from "@/lib/dates";
import type { StoredDecision, Task } from "@/lib/types";

export default function StatsStrip({
  decisions,
  tasks,
}: {
  decisions: StoredDecision[];
  tasks: Task[];
}) {
  const stats = [
    {
      label: "Active decisions",
      value: decisions.filter((d) => !d.supersededBy).length,
      tone: "text-indigo-700",
    },
    {
      label: "Superseded",
      value: decisions.filter((d) => d.supersededBy).length,
      tone: "text-rose-700",
    },
    {
      label: "Open tasks",
      value: tasks.filter((t) => t.status !== "done").length,
      tone: "text-slate-900",
    },
    {
      label: "Overdue",
      value: tasks.filter((t) => isOverdue(t)).length,
      tone: "text-red-700",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Agent memory summary">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
        >
          <p className={`text-2xl font-semibold ${stat.tone}`}>{stat.value}</p>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );
}
