"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AgentActivityPanel from "@/components/AgentActivityPanel";
import Avatar from "@/components/Avatar";
import ConflictsBanner from "@/components/ConflictsBanner";
import ErrorBanner from "@/components/ErrorBanner";
import MicIcon from "@/components/MicIcon";
import RemindersPanel from "@/components/RemindersPanel";
import ResetDemo from "@/components/ResetDemo";
import StatsStrip from "@/components/StatsStrip";
import TranscriptCompare from "@/components/TranscriptCompare";
import { analyzeMeeting, AnalyzeError } from "@/lib/analyze";
import {
  applySupersedes,
  bestMatch,
  findClarifications,
  findLocalConflicts,
  isDuplicateDecision,
  type Resolution,
} from "@/lib/conflicts";
import { formatDate, toIsoDate } from "@/lib/dates";
import { buildDemo } from "@/lib/demos";
import {
  EMPTY_DRAFT,
  type DraftAction,
  type DraftDecision,
  type DraftQuestion,
  type MeetingDraft,
} from "@/lib/draft";
import { canonicalOwner } from "@/lib/owners";
import { STORAGE_KEYS } from "@/lib/storage";
import { findSimilarTask, planTaskUpdate } from "@/lib/tasks";
import type { ExtractResult, StoredDecision, Task } from "@/lib/types";
import { useLocalStorage } from "@/lib/use-local-storage";
import { countVoiceNoise } from "@/lib/voice";

function patch<T extends { id: string }>(list: T[], id: string, change: Partial<T>): T[] {
  return list.map((d) => (d.id === id ? { ...d, ...change } : d));
}

const card = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
const field =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm outline-none ring-indigo-500 focus:ring-2";

const STEPS = ["Dictate or load", "Analyze with Gemini", "Review & resolve", "Confirm to board"];

export default function MeetingsPage() {
  const router = useRouter();
  const decisionsStore = useLocalStorage<StoredDecision[]>(STORAGE_KEYS.decisions, []);
  const tasksStore = useLocalStorage<Task[]>(STORAGE_KEYS.tasks, []);
  const draftStore = useLocalStorage<MeetingDraft>(STORAGE_KEYS.draft, EMPTY_DRAFT);
  const flashStore = useLocalStorage<string>(STORAGE_KEYS.flash, "");

  // The draft lives in storage, so it survives moving between tabs and reloads.
  const draft = useMemo<MeetingDraft>(
    () => ({ ...EMPTY_DRAFT, ...draftStore.value }),
    [draftStore.value],
  );
  const update = (change: Partial<MeetingDraft>) =>
    draftStore.setValue((prev) => ({ ...EMPTY_DRAFT, ...prev, ...change }));
  const edit = <K extends "decisions" | "actions" | "questions">(
    key: K,
    fn: (list: MeetingDraft[K]) => MeetingDraft[K],
  ) =>
    draftStore.setValue((prev) => {
      const base = { ...EMPTY_DRAFT, ...prev };
      return { ...base, [key]: fn(base[key]) };
    });

  const { title: meetingTitle, transcript, result, resolutions } = draft;
  const draftDecisions = draft.decisions;
  const draftActions = draft.actions;
  const draftQuestions = draft.questions;
  const warnedMissing = draft.warnedMissing;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);

  const voice = useMemo(() => countVoiceNoise(transcript), [transcript]);
  const conflicts = result?.conflicts ?? [];
  const unresolved = conflicts.filter((_, index) => !resolutions[index]).length;
  const clarifications = useMemo(
    () => findClarifications(draftActions.filter((item) => item.selected)),
    [draftActions],
  );
  const speakerHint = transcript.includes(":") === false && transcript.trim().length > 0;

  // Action items that restate a task already on the board.
  const matches = useMemo(() => {
    const found: Record<string, ReturnType<typeof planTaskUpdate> & { existing: Task }> = {};
    for (const item of draftActions) {
      if (!item.selected) continue;
      const existing = findSimilarTask(item, tasksStore.value);
      if (existing) {
        found[item.id] = {
          ...planTaskUpdate(existing, item, meetingTitle.trim() || "this meeting"),
          existing,
        };
      }
    }
    return found;
  }, [draftActions, tasksStore.value, meetingTitle]);
  const modeOf = (id: string) => draft.taskModes[id] ?? "update";

  const activeDecisions = decisionsStore.value.filter((d) => !d.supersededBy);
  const nextDemo: 1 | 2 = activeDecisions.length === 0 ? 1 : 2;
  const hasDraft = Boolean(transcript.trim() || result || meetingTitle.trim());

  const stage = !transcript.trim() ? 0 : !result ? 1 : unresolved > 0 || clarifications.length > 0 ? 2 : 3;
  const nextHint = [
    "Click the transcript box and dictate with Wispr Flow, or start the guided demo.",
    "Transcript ready. Press Analyze meeting.",
    unresolved > 0
      ? `${unresolved} conflict${unresolved === 1 ? "" : "s"} need your decision below.`
      : "Review what the agent flagged below, then confirm.",
    "Everything is resolved. Confirm to create the tasks.",
  ][stage];

  function defaultTitle() {
    return `Meeting ${toIsoDate(new Date())}`;
  }

  function loadDemo(n: 1 | 2) {
    const demo = buildDemo(n, toIsoDate(new Date()));
    setError("");
    draftStore.setValue({ ...EMPTY_DRAFT, title: demo.title, transcript: demo.transcript });
  }

  function newMeeting() {
    setError("");
    draftStore.setValue(EMPTY_DRAFT);
  }

  async function analyze() {
    setError("");
    update({ result: null, resolutions: {}, warnedMissing: false, taskModes: {} });
    setLoading(true);
    const sent = transcript;
    try {
      const data = await analyzeMeeting({
        mode: "extract",
        transcript: sent,
        meetingTitle: meetingTitle.trim() || defaultTitle(),
        previousDecisions: decisionsStore.value.filter((d) => !d.supersededBy),
        tasks: tasksStore.value,
        today: toIsoDate(new Date()),
      });
      const raw = data as ExtractResult;
      // Second layer: a deterministic check against memory, in case the model misses a contradiction.
      const memoryConflicts = findLocalConflicts(
        raw.decisions ?? [],
        decisionsStore.value.filter((d) => !d.supersededBy),
        raw.conflicts ?? [],
      );
      const extracted: ExtractResult = {
        ...raw,
        conflicts: [...(raw.conflicts ?? []), ...memoryConflicts],
      };
      update({
        analyzedTranscript: sent,
        result: extracted,
        resolutions: {},
        warnedMissing: false,
        taskModes: {},
        decisions: (extracted.decisions ?? []).map((item, index) => ({
          ...item,
          id: item.id || `decision-${index + 1}`,
          selected: true,
        })),
        actions: (extracted.actionItems ?? []).map((item, index) => ({
          ...item,
          id: item.id || `task-${index + 1}`,
          selected: true,
        })),
        questions: (extracted.openQuestions ?? []).map((text, index) => ({
          id: `q-${index + 1}`,
          text,
          selected: true,
        })),
      });
      setTimeout(
        () => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        150,
      );
    } catch (err) {
      update({ result: null });
      setError(
        err instanceof AnalyzeError
          ? err.message
          : "The AI service is busy right now. Please retry in a moment.",
      );
    } finally {
      setLoading(false);
    }
  }

  function resolveConflict(index: number, choice: Resolution) {
    const conflict = conflicts[index];
    draftStore.setValue((prev) => {
      const base = { ...EMPTY_DRAFT, ...prev };
      let decisions = base.decisions;
      if (conflict) {
        const target = bestMatch(decisions, conflict.newDecision, (d) => d.text, 0.3);
        if (target) {
          decisions = decisions.map((d) =>
            d.id === target.id ? { ...d, selected: choice !== "reject" } : d,
          );
        }
      }
      return { ...base, decisions, resolutions: { ...base.resolutions, [index]: choice } };
    });
  }

  function confirmAndCreate() {
    if (unresolved > 0) return;
    if (clarifications.length > 0 && !warnedMissing) {
      update({ warnedMissing: true });
      return;
    }
    const title = meetingTitle.trim() || defaultTitle();
    const date = toIsoDate(new Date());
    const knownOwners = [
      ...tasksStore.value.map((t) => t.owner),
      ...decisionsStore.value.map((d) => d.owner),
    ];
    const owner = (name: string) => canonicalOwner(name, knownOwners);
    const keptDecisions: StoredDecision[] = draftDecisions
      .filter((item) => item.selected)
      .map((item) => ({
        id: item.id,
        text: item.text,
        owner: owner(item.owner),
        quote: item.quote,
        meetingTitle: title,
        date,
      }));
    const taskKey = (t: { task: string; owner: string; deadline: string | null; meetingTitle: string }) =>
      [t.task, t.owner, t.deadline ?? "", t.meetingTitle]
        .map((part) => part.toLowerCase().replace(/\s+/g, " ").trim())
        .join("|");

    // Restated tasks update the existing card instead of creating a duplicate.
    let boardTasks = [...tasksStore.value];
    let updatedCount = 0;
    let unchangedCount = 0;
    const createdTasks: Task[] = [];
    draftActions
      .filter((item) => item.selected)
      .forEach((item, index) => {
        const match = matches[item.id];
        if (match && modeOf(item.id) === "update") {
          if (match.changed) {
            boardTasks = boardTasks.map((t) => (t.id === match.existing.id ? match.task : t));
            updatedCount += 1;
          } else {
            unchangedCount += 1;
          }
          return;
        }
        createdTasks.push({
          id: `${item.id}-${Date.now()}-${index}`,
          task: item.task,
          owner: owner(item.owner),
          deadline: item.deadline,
          quote: item.quote,
          status: "todo",
          meetingTitle: title,
          createdAt: new Date().toISOString(),
        });
      });

    const knownTasks = new Set(boardTasks.map(taskKey));
    const newTasks = createdTasks.filter((t) => !knownTasks.has(taskKey(t)));
    const activeBefore = decisionsStore.value.filter((d) => !d.supersededBy);
    const newDecisions = keptDecisions.filter(
      (d) => !activeBefore.some((a) => isDuplicateDecision(a.text, d.text)),
    );
    const { next: updatedStored } = applySupersedes(
      decisionsStore.value,
      conflicts,
      resolutions,
      date,
    );
    const supersededCount = updatedStored.filter((d) => d.supersededBy).length -
      decisionsStore.value.filter((d) => d.supersededBy).length;

    decisionsStore.setValue([...updatedStored, ...newDecisions]);
    tasksStore.setValue([...boardTasks, ...newTasks]);
    const bits = [
      `created ${newTasks.length} task${newTasks.length === 1 ? "" : "s"}`,
      ...(updatedCount > 0
        ? [`updated ${updatedCount} existing task${updatedCount === 1 ? "" : "s"} instead of duplicating`]
        : []),
      ...(unchangedCount > 0 ? [`${unchangedCount} already tracked`] : []),
      `saved ${newDecisions.length} decision${newDecisions.length === 1 ? "" : "s"}`,
      ...(supersededCount > 0
        ? [`superseded ${supersededCount} old decision${supersededCount === 1 ? "" : "s"}`]
        : []),
    ];
    flashStore.setValue(`${bits[0].charAt(0).toUpperCase()}${bits[0].slice(1)}${bits.length > 1 ? ", " + bits.slice(1).join(", ") : ""} from “${title}”.`);
    draftStore.setValue(EMPTY_DRAFT);
    router.push("/board");
  }

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 md:p-8">
      {/* ---------- Hero ---------- */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-indigo-800 p-7 text-white shadow-lg md:p-9">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/30 blur-3xl" />
        <p className="relative inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-100">
          <MicIcon className="h-3.5 w-3.5" /> Meeting-to-execution agent
        </p>
        <h1 className="relative mt-4 max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
          Say it in the meeting. Watch it get done.
        </h1>
        <p className="relative mt-3 max-w-2xl text-[15px] leading-6 text-indigo-100">
          Dictate with Wispr Flow. Gemini cleans the speech, finds decisions, owners and
          deadlines, catches contradictions with past meetings, and asks before it guesses.
          Nothing is saved until you confirm.
        </p>
        <div className="relative mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => loadDemo(nextDemo)}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-indigo-900 shadow hover:bg-indigo-50"
          >
            ▶ {nextDemo === 1 ? "Start guided demo" : "Next: load demo meeting 2"}
          </button>
          {hasDraft && (
            <button
              type="button"
              onClick={newMeeting}
              className="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
            >
              New meeting
            </button>
          )}
          <ResetDemo />
          {hasDraft && (
            <span className="text-xs text-indigo-200">Draft saved automatically</span>
          )}
        </div>
        <ol className="relative mt-6 grid gap-2 sm:grid-cols-4" aria-label="Progress">
          {STEPS.map((label, index) => {
            const done = index < stage;
            const current = index === stage;
            return (
              <li
                key={label}
                aria-current={current ? "step" : undefined}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                  current
                    ? "bg-white text-indigo-900"
                    : done
                      ? "bg-emerald-400/20 text-emerald-100"
                      : "bg-white/10 text-indigo-200"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
                    current ? "bg-indigo-600 text-white" : done ? "bg-emerald-400 text-emerald-950" : "bg-white/20"
                  }`}
                >
                  {done ? "✓" : index + 1}
                </span>
                {label}
              </li>
            );
          })}
        </ol>
        <p className="relative mt-3 text-sm text-indigo-100">
          <span className="font-semibold text-white">Next:</span> {nextHint}
        </p>
      </header>

      <StatsStrip decisions={decisionsStore.value} tasks={tasksStore.value} />

      <ErrorBanner message={error} onRetry={error ? analyze : undefined} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-slate-700">
            Meeting title
            <input
              value={meetingTitle}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Launch planning"
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none ring-indigo-500 focus:ring-2"
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700">
            <span className="flex items-center justify-between gap-2">
              Transcript
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                <MicIcon className="h-3.5 w-3.5" /> Voice-first: dictate with Wispr Flow
              </span>
            </span>
            <textarea
              value={transcript}
              onChange={(e) => update({ transcript: e.target.value })}
              placeholder={"Click here, hold your Wispr Flow hotkey and speak:\nAlex: Let's lock the launch date...\nPriya: I'll own the landing page..."}
              rows={14}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm outline-none ring-indigo-500 focus:ring-2"
            />
          </label>
          {transcript.trim() && (voice.fillers > 0 || voice.corrections > 0) && (
            <p role="status" className="mt-2 text-sm text-indigo-700">
              Live voice check: {voice.fillers} filler word{voice.fillers === 1 ? "" : "s"} and{" "}
              {voice.corrections} self-correction{voice.corrections === 1 ? "" : "s"} detected.
              The agent will clean these.
            </p>
          )}
          {speakerHint && (
            <p className="mt-2 text-sm text-amber-700">
              Use the format Speaker: text so owners can be attributed correctly.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadDemo(1)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Load demo meeting 1
            </button>
            <button
              type="button"
              onClick={() => loadDemo(2)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Load demo meeting 2
            </button>
          </div>
          <button
            type="button"
            onClick={analyze}
            disabled={loading || !transcript.trim()}
            className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? "Analyzing meeting…" : "Analyze meeting"}
          </button>
          <p className="mt-3 text-xs text-slate-500">
            Tip: confirm meeting 1 first so meeting 2 can detect budget and launch-date conflicts.
          </p>
        </section>

        <div className="flex flex-col gap-6">
          <AgentActivityPanel
            trace={result?.trace ?? null}
            loading={loading}
            failed={Boolean(error)}
            confirmed={false}
            onRetry={error ? analyze : undefined}
          />
          <RemindersPanel tasks={tasksStore.value} />
        </div>
      </div>

      <div ref={resultsRef} className="scroll-mt-6" />

      {loading && (
        <section className="space-y-3" aria-label="Analyzing">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </section>
      )}

      {result && !loading && (
        <section className="space-y-5">
          {result.fromCache && (
            <div
              role="status"
              className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            >
              <p className="font-semibold">Demo fallback: AI service busy, showing cached result</p>
              {result.fallbackReason && (
                <p className="mt-1 text-xs text-amber-900">Gemini said: {result.fallbackReason}</p>
              )}
            </div>
          )}

          <ConflictsBanner
            conflicts={conflicts}
            resolutions={resolutions}
            onResolve={resolveConflict}
          />

          <p className="text-sm text-slate-600">
            Review and edit below. Uncheck anything that should not be created.
          </p>

          <TranscriptCompare raw={draft.analyzedTranscript} cleaned={result.cleanedTranscript} />

          <div>
            <h3 className="mb-3 text-lg font-semibold">Decisions</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {draftDecisions.map((item: DraftDecision) => (
                <article key={item.id} className={`${card} border-l-4 border-l-indigo-500`}>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={(e) =>
                        edit("decisions", (p) => patch(p, item.id, { selected: e.target.checked }))
                      }
                    />
                    Keep decision
                  </label>
                  <textarea
                    value={item.text}
                    onChange={(e) => edit("decisions", (p) => patch(p, item.id, { text: e.target.value }))}
                    className={`mt-3 ${field}`}
                    rows={3}
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <Avatar name={item.owner} size="sm" />
                    <input
                      value={item.owner}
                      onChange={(e) => edit("decisions", (p) => patch(p, item.id, { owner: e.target.value }))}
                      className={field}
                      placeholder="Owner"
                    />
                  </div>
                  <p className="mt-2 text-xs italic text-slate-500">“{item.quote}”</p>
                </article>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-semibold">Action items</h3>
            {clarifications.length > 0 && (
              <div
                role="status"
                className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
              >
                <p className="font-semibold">Needs clarification ({clarifications.length})</p>
                <p className="mt-1">
                  The agent will not guess. Fill in the missing owner or date below, or ask the team:
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {clarifications.map((item) => (
                    <li key={item.id}>{item.question}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {draftActions.map((item: DraftAction) => (
                <article key={item.id} className={`${card} border-l-4 border-l-emerald-500`}>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={(e) =>
                        edit("actions", (p) => patch(p, item.id, { selected: e.target.checked }))
                      }
                    />
                    Create task
                  </label>
                  <textarea
                    value={item.task}
                    onChange={(e) => edit("actions", (p) => patch(p, item.id, { task: e.target.value }))}
                    className={`mt-3 ${field}`}
                    rows={3}
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={item.owner} size="sm" />
                      <input
                        value={item.owner}
                        onChange={(e) => edit("actions", (p) => patch(p, item.id, { owner: e.target.value }))}
                        className={field}
                        placeholder="Owner"
                      />
                    </div>
                    <input
                      type="date"
                      value={item.deadline ?? ""}
                      onChange={(e) =>
                        edit("actions", (p) => patch(p, item.id, { deadline: e.target.value || null }))
                      }
                      className={field}
                    />
                  </div>
                  {matches[item.id] && (
                    <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
                      <p className="font-semibold">Already on the board</p>
                      <p className="mt-0.5">
                        “{matches[item.id].existing.task}” ({matches[item.id].existing.owner}
                        {matches[item.id].existing.deadline
                          ? `, due ${formatDate(matches[item.id].existing.deadline)}`
                          : ""}
                        ).{" "}
                        {matches[item.id].changed
                          ? `Update it (${matches[item.id].summary}) instead of creating a duplicate?`
                          : "Same owner and date, so nothing needs to change."}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Existing task">
                        <button
                          type="button"
                          aria-pressed={modeOf(item.id) === "update"}
                          onClick={() =>
                            update({ taskModes: { ...draft.taskModes, [item.id]: "update" } })
                          }
                          className={`rounded-lg border px-2.5 py-1 font-semibold ${
                            modeOf(item.id) === "update"
                              ? "border-sky-700 bg-sky-700 text-white"
                              : "border-sky-300 bg-white text-sky-900 hover:bg-sky-100"
                          }`}
                        >
                          {matches[item.id].changed ? "Update existing task" : "Keep existing task"}
                        </button>
                        <button
                          type="button"
                          aria-pressed={modeOf(item.id) === "new"}
                          onClick={() =>
                            update({ taskModes: { ...draft.taskModes, [item.id]: "new" } })
                          }
                          className={`rounded-lg border px-2.5 py-1 font-semibold ${
                            modeOf(item.id) === "new"
                              ? "border-slate-800 bg-slate-800 text-white"
                              : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                          }`}
                        >
                          Create as new task
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="mt-2 text-xs italic text-slate-500">“{item.quote}”</p>
                </article>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-semibold">Open questions</h3>
            <div className="space-y-2">
              {draftQuestions.length === 0 && (
                <p className="text-sm text-slate-500">No open questions.</p>
              )}
              {draftQuestions.map((item: DraftQuestion) => (
                <label
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={item.selected}
                    onChange={(e) =>
                      edit("questions", (p) => patch(p, item.id, { selected: e.target.checked }))
                    }
                  />
                  <textarea
                    value={item.text}
                    onChange={(e) => edit("questions", (p) => patch(p, item.id, { text: e.target.value }))}
                    className={field}
                    rows={2}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {unresolved > 0 && (
              <p role="status" className="text-sm font-medium text-red-700">
                Resolve {unresolved} conflict{unresolved === 1 ? "" : "s"} above before confirming.
              </p>
            )}
            {unresolved === 0 && warnedMissing && clarifications.length > 0 && (
              <p role="status" className="text-sm font-medium text-amber-800">
                {clarifications.length} action item{clarifications.length === 1 ? " is" : "s are"} still
                missing an owner or date. Fix them above, or click again to create anyway.
              </p>
            )}
            <button
              type="button"
              onClick={confirmAndCreate}
              disabled={unresolved > 0}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {warnedMissing && clarifications.length > 0
                ? "Create tasks anyway"
                : "Confirm and create tasks"}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
