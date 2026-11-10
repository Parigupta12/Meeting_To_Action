"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MicIcon from "@/components/MicIcon";
import { STORAGE_KEYS } from "@/lib/storage";
import type { StoredDecision, Task } from "@/lib/types";
import { useLocalStorage } from "@/lib/use-local-storage";

const links = [
  { href: "/", label: "Meetings", hint: "Transcripts" },
  { href: "/board", label: "Board", hint: "Tasks · voice" },
  { href: "/memory", label: "Memory", hint: "Decisions" },
  { href: "/digest", label: "Digest", hint: "Weekly" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const tasks = useLocalStorage<Task[]>(STORAGE_KEYS.tasks, []).value;
  const decisions = useLocalStorage<StoredDecision[]>(STORAGE_KEYS.decisions, []).value;
  const counts: Record<string, number> = {
    "/board": tasks.filter((t) => t.status !== "done").length,
    "/memory": decisions.filter((d) => !d.supersededBy).length,
  };

  return (
    <aside className="flex w-full shrink-0 flex-col border-b md:w-64 md:border-b-0 md:border-r border-slate-800 bg-slate-950 text-slate-300">
      <div className="px-5 py-4 md:border-b md:border-slate-800 md:py-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-indigo-400">
          Agent
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-white">
          MeetingToAction
        </h1>
        <p className="mt-2 hidden text-sm leading-5 text-slate-400 md:block">
          Meeting to execution. Confirm before anything is saved.
        </p>
      </div>
      <nav className="flex gap-1 overflow-x-auto p-3 md:flex-1 md:flex-col">
        {links.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`min-w-28 shrink-0 rounded-lg px-3 py-2.5 transition md:min-w-0 ${
                active
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40"
                  : "hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="flex items-center justify-between text-sm font-medium">
                {link.label}
                {counts[link.href] > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      active ? "bg-white/25 text-white" : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {counts[link.href]}
                  </span>
                )}
              </span>
              <span
                className={`block text-xs ${active ? "text-indigo-100" : "text-slate-500"}`}
              >
                {link.hint}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="hidden space-y-2 px-5 py-4 text-xs text-slate-500 md:block">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/15 px-2.5 py-1 font-semibold text-indigo-300">
          <MicIcon className="h-3 w-3" /> Voice-first · Wispr Flow
        </p>
        <p>Powered by Gemini. No login. Your data stays in this browser.</p>
      </div>
    </aside>
  );
}
