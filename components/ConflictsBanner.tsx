import type { Resolution } from "@/lib/conflicts";
import type { Conflict } from "@/lib/types";

const options: { id: Resolution; label: string; hint: string; active: string }[] = [
  {
    id: "supersede",
    label: "Supersede old decision",
    hint: "The new decision replaces the old one. The old one stays in Memory, struck through.",
    active: "border-indigo-700 bg-indigo-700 text-white",
  },
  {
    id: "keep",
    label: "Keep both",
    hint: "Both stay active.",
    active: "border-slate-900 bg-slate-900 text-white",
  },
  {
    id: "reject",
    label: "Reject new decision",
    hint: "The new decision is not saved.",
    active: "border-rose-700 bg-rose-700 text-white",
  },
];

export default function ConflictsBanner({
  conflicts,
  resolutions,
  onResolve,
}: {
  conflicts: Conflict[];
  resolutions?: Record<number, Resolution>;
  onResolve?: (index: number, choice: Resolution) => void;
}) {
  if (!conflicts.length) return null;

  const resolved = resolutions ? conflicts.filter((_, index) => resolutions[index]).length : 0;
  const allDone = onResolve && resolved === conflicts.length;

  return (
    <div
      className={`rounded-3xl border-2 p-5 shadow-sm md:p-6 ${
        allDone ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"
      }`}
      role="alert"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className={`text-xs font-bold uppercase tracking-widest ${
              allDone ? "text-emerald-700" : "text-red-700"
            }`}
          >
            ⚠ Conflicts with earlier decisions
          </p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            This meeting contradicts {conflicts.length} stored decision
            {conflicts.length === 1 ? "" : "s"}. Review before you confirm.
          </p>
          <p className="mt-1 text-sm text-slate-700">
            The agent remembered what the team decided before. You decide which version wins.
          </p>
        </div>
        {onResolve && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              allDone ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            {resolved} of {conflicts.length} resolved
          </span>
        )}
      </div>

      <ul className="mt-5 space-y-4">
        {conflicts.map((conflict, index) => {
          const chosen = resolutions?.[index];
          return (
            <li
              key={`${conflict.newDecision}-${index}`}
              className="overflow-hidden rounded-2xl border border-black/10 bg-white text-sm shadow-sm"
            >
              <div className="grid md:grid-cols-[1fr_auto_1fr]">
                <div className="bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Earlier · {conflict.earlierMeeting}
                  </p>
                  <p className="mt-1 text-slate-500 line-through decoration-red-400 decoration-2">
                    {conflict.earlierDecision}
                  </p>
                </div>
                <div
                  className="flex items-center justify-center bg-white px-2 py-1 text-2xl font-bold text-red-500 md:px-4"
                  aria-hidden
                >
                  <span className="md:hidden">↓</span>
                  <span className="hidden md:inline">→</span>
                </div>
                <div className="bg-red-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700">
                    Now · {conflict.severity} severity
                    {conflict.source === "memory-check" ? " · caught by memory check" : ""}
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">{conflict.newDecision}</p>
                </div>
              </div>
              <div className="border-t border-slate-200 p-4">
                <p className="text-slate-700">
                  <span className="font-semibold">Why: </span>
                  {conflict.explanation}
                </p>
                {onResolve && (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Resolve conflict">
                      {options.map((option) => {
                        const active = chosen === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={active}
                            title={option.hint}
                            onClick={() => onResolve(index, option.id)}
                            className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                              active
                                ? option.active
                                : "border-slate-300 bg-white text-slate-800 hover:border-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            {active ? "✓ " : ""}
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    {chosen && (
                      <p className="mt-2 text-xs text-slate-500">
                        {options.find((o) => o.id === chosen)?.hint}
                      </p>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
