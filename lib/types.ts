export type Decision = {
  id: string;
  text: string;
  owner: string;
  quote: string;
};

export type StoredDecision = Decision & {
  meetingTitle: string;
  date: string;
  supersededBy?: string;
  supersededOn?: string;
};

export type ActionItem = {
  id: string;
  task: string;
  owner: string;
  deadline: string | null;
  quote: string;
};

export type TaskStatus = "todo" | "doing" | "done";

export type Task = ActionItem & {
  status: TaskStatus;
  meetingTitle: string;
  createdAt: string;
  /** Plain-language history, e.g. "Deadline Nov 5 → Nov 10 (Launch check-in)". */
  note?: string;
};

export type Conflict = {
  newDecision: string;
  earlierDecision: string;
  earlierMeeting: string;
  explanation: string;
  severity: "low" | "medium" | "high";
  /** "memory-check" = caught by the deterministic check rather than the model. */
  source?: "ai" | "memory-check";
};

export type AgentActivityStep = {
  id: string;
  title: string;
  result: string;
};

export type TraceStep = {
  step: string;
  detail: string;
};

export type ExtractResult = {
  cleanedTranscript: string;
  decisions: Decision[];
  actionItems: ActionItem[];
  openQuestions: string[];
  conflicts: Conflict[];
  activity?: AgentActivityStep[];
  trace?: TraceStep[];
  fromCache?: boolean;
  fallbackReason?: string;
};

export type Digest = {
  person: string;
  summary: string;
  dueSoon: string[];
  decisionsAffectingYou: string[];
};

export type DigestResult = {
  digests: Digest[];
  generatedLocally?: boolean;
};

export type AnalyzeExtractRequest = {
  mode: "extract";
  today?: string;
  transcript: string;
  meetingTitle: string;
  previousDecisions: StoredDecision[];
  tasks?: Task[];
};

export type AnalyzeDigestRequest = {
  mode: "digest";
  today?: string;
  transcript?: string;
  meetingTitle?: string;
  previousDecisions?: StoredDecision[];
  tasks: Task[];
};

export type TaskChange = {
  type: "move" | "reschedule" | "reassign" | "add" | "delete";
  taskId?: string;
  status?: TaskStatus;
  deadline?: string | null;
  owner?: string;
  task?: string;
  summary?: string;
};

export type CommandPlan = {
  interpretation: string;
  changes: TaskChange[];
  clarification?: string | null;
  offline?: boolean;
  reason?: string;
  model?: string;
};

export type AnalyzeCommandRequest = {
  mode: "command";
  command: string;
  tasks: Task[];
  today?: string;
};

export type AnalyzeRequest =
  | AnalyzeExtractRequest
  | AnalyzeDigestRequest
  | AnalyzeCommandRequest;
