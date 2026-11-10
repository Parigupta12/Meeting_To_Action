"use client";

import { PENDING_TRACE, stepsFromTrace } from "@/lib/activity";
import type { TraceStep } from "@/lib/types";

export default function AgentActivityPanel({
  trace,
  loading,
  failed,
  confirmed,
  onRetry,
}: {
  trace: TraceStep[] | null;
  loading: boolean;
  failed: boolean;
  confirmed: boolean;
  onRetry?: () => void;
}) {
  if (!loading && !trace && !failed) return null;

  const shown = stepsFromTrace(
    loading ? PENDING_TRACE : trace && trace.length > 0 ? trace : PENDING_TRACE,
    { confirmed, failed: failed && !loading },
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Agent activity
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {loading
          ? "Analyzing this meeting…"
          : failed
            ? "Analysis stopped"
            : "Steps from this analysis"}
      </p>
      <ol className="mt-3 space-y-2.5">
        {shown.map((step, index) => {
          const pending = loading;
          const isFailed = failed && !loading;
          return (
            <li key={`${step.id}-${index}`} className="flex gap-2.5">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  pending
                    ? "border border-slate-300 text-slate-400"
                    : isFailed
                      ? "bg-red-100 text-red-700"
                      : "bg-emerald-100 text-emerald-700"
                }`}
                aria-hidden
              >
                {pending ? index + 1 : isFailed ? "!" : "✓"}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-5 text-slate-900">
                  {step.title}
                </p>
                <p className="text-xs leading-4 text-slate-500">{step.result}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {failed && !loading && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Retry
        </button>
      )}
    </section>
  );
}
