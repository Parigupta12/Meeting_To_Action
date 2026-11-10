"use client";

import { useRef, useState } from "react";
import MicIcon from "@/components/MicIcon";
import { analyzeMeeting, AnalyzeError } from "@/lib/analyze";
import { applyChanges, describeChange } from "@/lib/commands";
import { toIsoDate } from "@/lib/dates";
import type { CommandPlan, Task } from "@/lib/types";

const EXAMPLES = [
  "Priya finished the landing page",
  "Push the design ping to next Friday",
  "Add a task for Lee to review pricing by Wednesday",
  "Assign the legal check to Jordan",
];

export default function VoiceCommandPanel({
  tasks,
  setTasks,
}: {
  tasks: Task[];
  setTasks: (next: Task[]) => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<CommandPlan | null>(null);
  const [picked, setPicked] = useState<boolean[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [undo, setUndo] = useState<Task[] | null>(null);
  const [asked, setAsked] = useState("");

  async function run() {
    const command = text.trim();
    if (!command || busy) return;
    setBusy(true);
    setError("");
    setNote("");
    setPlan(null);
    try {
      const data = await analyzeMeeting({
        mode: "command",
        command,
        today: toIsoDate(new Date()),
        tasks,
      });
      const result: CommandPlan = {
        interpretation: data.interpretation ?? "Here is what I understood.",
        changes: data.changes ?? [],
        clarification: data.clarification ?? null,
        offline: data.offline,
        reason: data.reason,
        model: data.model,
      };
      setAsked(command);
      setPlan(result);
      setPicked(result.changes.map(() => true));
    } catch (err) {
      setError(
        err instanceof AnalyzeError ? err.message : "Could not reach the agent. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function apply() {
    if (!plan) return;
    const chosen = plan.changes.filter((_, i) => picked[i]);
    if (chosen.length === 0) return;
    setUndo(tasks);
    setTasks(applyChanges(tasks, chosen, asked));
    setNote(`Applied ${chosen.length} change${chosen.length === 1 ? "" : "s"}.`);
    setPlan(null);
    setText("");
    inputRef.current?.focus();
  }

  function undoLast() {
    if (!undo) return;
    setTasks(undo);
    setUndo(null);
    setNote("Undone. The board is back to how it was.");
  }

  return (
    <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-indigo-700">
            <MicIcon className="h-3.5 w-3.5" /> Voice command
          </p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">Tell the agent what changed</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Click the box, hold your Wispr Flow hotkey and just say it. The agent turns it into
            board changes and shows them to you first. Nothing changes until you apply.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void run();
            }
          }}
          rows={2}
          aria-label="Voice command"
          placeholder="e.g. “Priya finished the landing page, and push the design ping to next Friday”"
          className="min-h-[3.5rem] flex-1 rounded-xl border border-indigo-200 bg-white px-3 py-2 text-[15px] outline-none ring-indigo-500 focus:ring-2"
        />
        <button
          type="button"
          onClick={run}
          disabled={busy || !text.trim()}
          className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 sm:self-stretch"
        >
          {busy ? "Understanding…" : "Run command"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => {
              setText(example);
              inputRef.current?.focus();
            }}
            className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-50"
          >
            {example}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {plan && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4" role="status">
          <p className="text-sm text-slate-500">
            I heard: <span className="font-medium text-slate-800">“{asked}”</span>
          </p>
          <p className="mt-1 font-semibold text-slate-900">{plan.interpretation}</p>

          {plan.changes.length > 0 ? (
            <>
              <ul className="mt-3 space-y-2">
                {plan.changes.map((change, i) => (
                  <li key={i}>
                    <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={Boolean(picked[i])}
                        onChange={(e) =>
                          setPicked((p) => p.map((v, j) => (j === i ? e.target.checked : v)))
                        }
                      />
                      <span>{describeChange(change, tasks)}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={apply}
                  disabled={!picked.some(Boolean)}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
                >
                  Apply to board
                </button>
                <button
                  type="button"
                  onClick={() => setPlan(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <span className="text-xs text-slate-500">
                  {plan.offline
                    ? `Understood by the offline parser${plan.reason ? ` (Gemini: ${plan.reason})` : ""}.`
                    : plan.model
                      ? `Understood by ${plan.model}.`
                      : ""}
                </span>
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm font-medium text-amber-800">
              {plan.clarification ?? "I could not match that to a task."}
            </p>
          )}
        </div>
      )}

      {(note || undo) && (
        <p role="status" className="mt-3 flex flex-wrap items-center gap-3 text-sm text-emerald-800">
          {note}
          {undo && (
            <button
              type="button"
              onClick={undoLast}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Undo
            </button>
          )}
        </p>
      )}
    </section>
  );
}
