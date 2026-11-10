import type {
  ActionItem,
  AgentActivityStep,
  Conflict,
  Decision,
  TraceStep,
} from "./types";

function count(items: unknown): number {
  return Array.isArray(items) ? items.length : 0;
}

function countSelfCorrections(transcript?: string) {
  if (!transcript) return 0;
  return (transcript.match(/\bno wait\b|\bI mean\b/gi) ?? []).length;
}

export function buildTrace(
  parsed: {
    cleanedTranscript?: string;
    decisions?: Decision[];
    actionItems?: ActionItem[];
    conflicts?: Conflict[];
  },
  previousDecisionsCount: number,
  options: {
    fromCache?: boolean;
    model?: string;
    attempt?: number;
    originalTranscript?: string;
  } = {},
): TraceStep[] {
  const decisions = count(parsed.decisions);
  const actions = count(parsed.actionItems);
  const conflicts = count(parsed.conflicts);
  const corrections = countSelfCorrections(options.originalTranscript);

  const trace: TraceStep[] = [
    {
      step: "clean",
      detail:
        corrections > 0
          ? `Removed fillers, applied ${corrections} self-correction${
              corrections === 1 ? "" : "s"
            }`
          : "Removed fillers, applied self-corrections",
    },
    {
      step: "extract",
      detail: `${decisions} ${
        decisions === 1 ? "decision" : "decisions"
      }, ${actions} ${actions === 1 ? "action item" : "action items"}`,
    },
    {
      step: "memory",
      detail: `Checked ${previousDecisionsCount} earlier ${
        previousDecisionsCount === 1 ? "decision" : "decisions"
      }`,
    },
    {
      step: "conflicts",
      detail: `${conflicts} ${conflicts === 1 ? "conflict" : "conflicts"} found`,
    },
  ];

  if (options.fromCache) {
    trace.push({
      step: "model",
      detail: "Gemini busy, used cached demo result",
    });
  } else if (options.model) {
    trace.push({
      step: "model",
      detail: `${options.model} (attempt ${options.attempt ?? 1})`,
    });
  }

  return trace;
}

const TITLES: Record<string, string> = {
  clean: "Cleaned transcript",
  extract: "Extracted decisions and action items",
  memory: "Checked memory against earlier decisions",
  conflicts: "Found conflicts",
  model: "Model",
  confirm: "Waiting for your confirmation",
};

export const PENDING_TRACE: TraceStep[] = [
  { step: "clean", detail: "Working…" },
  { step: "extract", detail: "Working…" },
  { step: "memory", detail: "Working…" },
  { step: "conflicts", detail: "Working…" },
  { step: "confirm", detail: "Pending" },
];

export function stepsFromTrace(
  trace: TraceStep[],
  options: { confirmed?: boolean; failed?: boolean } = {},
): AgentActivityStep[] {
  const steps = trace.map((item) => ({
    id: item.step,
    title: TITLES[item.step] ?? item.step,
    result: item.detail,
  }));

  const hasConfirm = steps.some((step) => step.id === "confirm");
  if (!hasConfirm) {
    steps.push({
      id: "confirm",
      title: options.confirmed ? "Confirmed" : TITLES.confirm,
      result: options.confirmed
        ? "Tasks and decisions are saved"
        : options.failed
          ? "Analysis failed"
          : "Nothing is saved until you confirm",
    });
  } else if (options.confirmed) {
    return steps.map((step) =>
      step.id === "confirm"
        ? { ...step, title: "Confirmed", result: "Tasks and decisions are saved" }
        : step,
    );
  }

  if (options.failed) {
    return steps.map((step) =>
      step.result === "Working…" || step.result === "Pending"
        ? { ...step, result: "Failed" }
        : step,
    );
  }

  return steps;
}
