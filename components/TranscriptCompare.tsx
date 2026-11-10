"use client";

import type { ReactNode } from "react";

const FILLER = /\b(uh-huh|um+|uh+|er|you know)\b/i;
const CORRECTION = /\b(no,? wait|wait,? no|i mean)\b/i;
const SPLIT = /(\buh-huh\b|\bum+\b|\buh+\b|\ber\b|\byou know\b|\bno,? wait\b|\bwait,? no\b|\bi mean\b)/gi;

function highlight(raw: string): { nodes: ReactNode[]; fillers: number; corrections: number } {
  let fillers = 0;
  let corrections = 0;
  const nodes = raw.split(SPLIT).map((part, index) => {
    if (CORRECTION.test(part) && part.match(CORRECTION)?.[0].length === part.length) {
      corrections += 1;
      return (
        <mark key={index} className="rounded bg-rose-100 px-0.5 text-rose-900">
          {part}
        </mark>
      );
    }
    if (FILLER.test(part) && part.match(FILLER)?.[0].length === part.length) {
      fillers += 1;
      return (
        <mark key={index} className="rounded bg-amber-100 px-0.5 text-amber-900">
          {part}
        </mark>
      );
    }
    return <span key={index}>{part}</span>;
  });
  return { nodes, fillers, corrections };
}

/** Keeps one speaker turn per paragraph even if the model returned a single blob. */
function formatCleaned(raw: string, cleaned: string) {
  const text = (cleaned || "").trim();
  if (!text) return "";
  const speakers = [
    ...new Set(
      [...raw.matchAll(/^\s*([A-Z][\w .'-]{0,24}):/gm)].map((m) => m[1].trim()),
    ),
  ];
  if (speakers.length === 0) return text;
  const names = speakers.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return text.replace(new RegExp(`[ \\t]+(?=(?:${names}):)`, "g"), "\n\n");
}

export default function TranscriptCompare({
  raw,
  cleaned,
}: {
  raw: string;
  cleaned: string;
}) {
  const { nodes, fillers, corrections } = highlight(raw);

  return (
    <details
      open
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <summary className="cursor-pointer font-medium">
        Voice cleanup: raw dictation vs cleaned transcript
      </summary>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">
          {fillers} filler word{fillers === 1 ? "" : "s"} removed
        </span>
        <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-900">
          {corrections} self-correction{corrections === 1 ? "" : "s"} resolved
        </span>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Raw (as dictated)
          </p>
          <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
            {nodes}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Cleaned by the agent
          </p>
          <p className="mt-2 whitespace-pre-wrap rounded-xl bg-emerald-50 p-3 text-sm leading-6 text-slate-800">
            {formatCleaned(raw, cleaned) || "No cleaned transcript returned."}
          </p>
        </div>
      </div>
    </details>
  );
}
