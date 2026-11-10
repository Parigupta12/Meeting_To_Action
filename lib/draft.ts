import type { Resolution } from "./conflicts";
import type { ActionItem, Decision, ExtractResult } from "./types";

export type DraftDecision = Decision & { selected: boolean };
export type DraftAction = ActionItem & { selected: boolean };
export type DraftQuestion = { id: string; text: string; selected: boolean };

/** Everything on the Meetings page that must survive navigating to another tab. */
export type MeetingDraft = {
  title: string;
  transcript: string;
  analyzedTranscript: string;
  result: ExtractResult | null;
  decisions: DraftDecision[];
  actions: DraftAction[];
  questions: DraftQuestion[];
  resolutions: Record<number, Resolution>;
  warnedMissing: boolean;
  /** For action items that match an existing task: update it, or create a new one. */
  taskModes: Record<string, "update" | "new">;
};

export const EMPTY_DRAFT: MeetingDraft = {
  title: "",
  transcript: "",
  analyzedTranscript: "",
  result: null,
  decisions: [],
  actions: [],
  questions: [],
  resolutions: {},
  warnedMissing: false,
  taskModes: {},
};
