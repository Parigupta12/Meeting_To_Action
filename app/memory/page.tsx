"use client";

import Avatar from "@/components/Avatar";
import PageHeader from "@/components/PageHeader";
import { tidyMemory } from "@/lib/conflicts";
import { STORAGE_KEYS } from "@/lib/storage";
import type { StoredDecision } from "@/lib/types";
import { useLocalStorage } from "@/lib/use-local-storage";

export default function MemoryPage() {
  const decisionsStore = useLocalStorage<StoredDecision[]>(STORAGE_KEYS.decisions, []);
  const all = decisionsStore.value;
  const active = all.filter((d) => !d.supersededBy).length;
  const superseded = all.length - active;

  const issues = tidyMemory(all, "");
  const hasIssues = issues.superseded + issues.merged > 0;

  // Newest meeting first.
  const grouped = [...all].reverse().reduce<Record<string, StoredDecision[]>>((acc, decision) => {
    const key = `${decision.date} · ${decision.meetingTitle}`;
    acc[key] = acc[key] ? [...acc[key], decision] : [decision];
    return acc;
  }, {});

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6 md:p-8">
      <PageHeader
        eyebrow="Memory"
        title="What the team has decided"
        actions={
          <>
            <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
              {active} active · {superseded} superseded
            </span>
            <button
              type="button"
              onClick={() => decisionsStore.setValue([])}
              className="rounded-xl border border-white/30 px-3.5 py-2 text-sm font-semibold hover:bg-white/10"
            >
              Clear memory
            </button>
          </>
        }
      >
        <p>
          Every confirmed decision is remembered. When a new meeting contradicts one of them, the
          agent flags it and you choose which version wins. Replaced decisions stay here, struck
          through, so the history is never lost.
        </p>
      </PageHeader>

      {hasIssues && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        >
          <p>
            <span className="font-semibold">Memory needs tidying. </span>
            {issues.superseded > 0 &&
              `${issues.superseded} active decision${issues.superseded === 1 ? " is" : "s are"} contradicted by a newer one on the same subject. `}
            {issues.merged > 0 &&
              `${issues.merged} repeat${issues.merged === 1 ? " was" : "s were"} saved in different words.`}
          </p>
          <button
            type="button"
            onClick={() => {
              const d = new Date();
              const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
              decisionsStore.setValue(tidyMemory(all, iso).next);
            }}
            className="rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-500"
          >
            Keep the newest, tidy the rest
          </button>
        </div>
      )}

      {all.length === 0 ? (
        <div
          role="status"
          className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-slate-500"
        >
          No decisions stored yet. Analyze a meeting and click Confirm and create tasks.
        </div>
      ) : (
        Object.entries(grouped).map(([group, items]) => (
          <section
            key={group}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="font-semibold text-slate-900">{group}</h3>
            <ul className="mt-3 space-y-3">
              {items.map((item) => (
                <li
                  key={`${item.id}-${item.date}`}
                  className={`rounded-xl border p-3 ${
                    item.supersededBy
                      ? "border-slate-200 bg-slate-100"
                      : "border-emerald-100 bg-emerald-50/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className={`font-medium ${
                        item.supersededBy ? "text-slate-500 line-through" : "text-slate-900"
                      }`}
                    >
                      {item.text}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        item.supersededBy
                          ? "bg-rose-100 text-rose-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {item.supersededBy ? "Superseded" : "Active"}
                    </span>
                  </div>
                  {item.supersededBy && (
                    <p className="mt-1 text-sm font-medium text-rose-700">
                      Superseded on {item.supersededOn}: {item.supersededBy}
                    </p>
                  )}
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                    <Avatar name={item.owner} size="sm" />
                    Owner: {item.owner}
                  </p>
                  {item.quote && (
                    <p className="mt-1 text-xs italic text-slate-500">“{item.quote}”</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
