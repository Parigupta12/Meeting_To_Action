import { NextResponse } from "next/server";
import { buildTrace } from "@/lib/activity";
import { parseCommandLocally, sanitizePlan } from "@/lib/commands";
import { getCachedDemoExtract, matchDemoTranscript } from "@/lib/demoCache";
import { buildLocalDigest, buildPersonFacts, summaryIsFaithful } from "@/lib/digest";
import { formatDate, parseIso } from "@/lib/dates";
import { FRIENDLY_BUSY } from "@/lib/errors";
import { rateLimit } from "@/lib/rateLimit";
import { generateJsonWithFallback } from "@/lib/gemini";
import type { StoredDecision, Task } from "@/lib/types";

export const maxDuration = 30;

function stripCodeFences(text: string) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/i, "");
  }
  return cleaned.trim();
}

function parseModelJson(text: string) {
  try {
    return JSON.parse(stripCodeFences(text));
  } catch {
    throw new Error("invalid-json");
  }
}

function extractSystemPrompt(today: string) {
  return `You are MeetingToAction, a meeting-to-execution agent.

The transcript is dictated speech with filler words, digressions and self-corrections. Use the speaker's FINAL corrected statement (for example "Friday, no wait, Monday" means Monday). Attribute everything to the correct speaker.

Compare the new decisions with previousDecisions and report any contradictions in "conflicts". Resolve relative dates ("next Friday", a bare weekday such as "Monday" = the next upcoming one) using today's date: ${today}. Deadlines must be ISO dates (YYYY-MM-DD) or null. Never return a deadline in the past.

Return ONLY JSON with this shape:
{
  "cleanedTranscript": string (one speaker turn per paragraph, formatted "Name: text", paragraphs separated by a blank line),
  "decisions": [{ "id": string, "text": string, "owner": string, "quote": string }],
  "actionItems": [{ "id": string, "task": string, "owner": string, "deadline": string | null, "quote": string }],
  "openQuestions": [string],
  "conflicts": [{ "newDecision": string, "earlierDecision": string, "earlierMeeting": string, "explanation": string, "severity": "low"|"medium"|"high" }]
}

Rules:
- ids must be unique short slugs.
- owner is the person responsible, or "Unassigned" if unclear.
- quote is a short verbatim snippet from the transcript.
- conflicts should only include real contradictions with previousDecisions (changed dates, changed budgets, reversed commitments). If none, return [].
- Do not invent attendees who are not in the transcript.
- If a decision is conditional or hedged ("unless legal flags something", "if engineering agrees", "pending approval"), add an open question that names the condition. If checking it needs someone to act and nobody claimed it, also add an action item for it with owner "Unassigned" and deadline null.
- If a speaker only restates an existing commitment ("keep the November 10th deadline"), still list it as an action item for its owner; the app merges it with the existing task.`;
}

function digestSystemPrompt(today: string) {
  return `You are MeetingToAction. You receive FACTS about each person's tasks and decisions. Write a short weekly digest summary (2 sentences) for each person using ONLY those facts.

Today's date is ${today}.

Rules:
- Never say a task was completed, finished or done unless it appears in that person's doneTasks.
- If overdueTasks is not empty, say plainly that those tasks are overdue and name them.
- Talk about tasks only; decisions are listed separately in the app, so do not mention them.
- Do not invent tasks, dates, people or decisions. Do not say "no open tasks" if openTasks is not empty.
- Dates are already written for humans (for example "Nov 9, 2026"); copy them exactly, never convert them to numbers like 2026-11-09.
- Speak to the person in the third person (for example "Priya has ...").

Return ONLY JSON: { "summaries": [{ "person": string, "summary": string }] }`;
}

function commandSystemPrompt(today: string) {
  return `You are the voice-command interpreter of MeetingToAction, a task board agent. The person dictated a short command with speech-to-text, so it may contain filler words or a self-correction; use their FINAL intent.

Map the command to changes on the EXISTING tasks (each has id, task, owner, deadline, status). Today is ${today}. Resolve dates to ISO YYYY-MM-DD; a bare weekday means the next upcoming one.

Return ONLY JSON:
{
  "interpretation": string (one short sentence: what you understood),
  "changes": [
    { "type": "move" | "reschedule" | "reassign" | "add" | "delete",
      "taskId": string (existing tasks only, copied exactly from the list; omit for "add"),
      "status": "todo" | "doing" | "done" (for move),
      "deadline": "YYYY-MM-DD" | null (for reschedule and add),
      "owner": string (for reassign and add),
      "task": string (for add: a clear task title),
      "summary": string }
  ],
  "clarification": string | null
}

Rules:
- Match tasks by meaning and owner. Only use taskIds that are in the provided list. Never invent ids.
- "finished", "shipped", "is live" mean status done. "started", "working on" mean doing.
- One command may change several tasks ("mark all of Priya's tasks done").
- Never delete unless the person clearly says delete, remove or cancel.
- If the command is ambiguous or matches no task, return an empty changes array and ask ONE short clarification question.`;
}

function asDecisionList(value: unknown): StoredDecision[] {
  return Array.isArray(value) ? (value as StoredDecision[]).slice(0, 200) : [];
}

function asTaskList(value: unknown): Task[] {
  return Array.isArray(value) ? (value as Task[]).slice(0, 300) : [];
}

function asExtract(parsed: unknown) {
  const value =
    parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  return {
    cleanedTranscript:
      typeof value.cleanedTranscript === "string" ? value.cleanedTranscript : "",
    decisions: Array.isArray(value.decisions) ? value.decisions : [],
    actionItems: Array.isArray(value.actionItems) ? value.actionItems : [],
    openQuestions: Array.isArray(value.openQuestions) ? value.openQuestions : [],
    conflicts: Array.isArray(value.conflicts) ? value.conflicts : [],
  };
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const perPerson = rateLimit(`ip:${ip}`, 20, 60_000);
    const overall = rateLimit("all", 600, 60 * 60_000);
    if (!perPerson.ok || !overall.ok) {
      return NextResponse.json(
        { error: "Too many requests right now. Please wait a few seconds and try again." },
        { status: 429, headers: { "Retry-After": String(perPerson.retryAfter || overall.retryAfter || 30) } },
      );
    }

    let body: {
      mode?: string;
      transcript?: string;
      meetingTitle?: string;
      previousDecisions?: unknown;
      tasks?: unknown;
      command?: string;
      today?: string;
    };

    try {
      body = await request.json();
    } catch {
      return jsonError("Request body must be valid JSON.", 400);
    }

    const mode = body.mode;
    if (mode !== "extract" && mode !== "digest" && mode !== "command") {
      return jsonError('mode must be "extract", "digest" or "command".', 400);
    }

    // The browser knows the person's local date; the server clock may be a day off.
    const clientToday = typeof body.today === "string" ? body.today : "";
    const today = /^\d{4}-\d{2}-\d{2}$/.test(clientToday)
      ? clientToday
      : new Date().toISOString().slice(0, 10);
    const previousDecisions = asDecisionList(body.previousDecisions);
    const tasks = asTaskList(body.tasks);
    const transcript = String(body.transcript ?? "");
    if (mode === "command") {
      const command = String(body.command ?? "").trim();
      if (!command) return jsonError("Say or type a command first.", 400);
      if (command.length > 600) return jsonError("That command is too long.", 413);
      const slim = tasks.map((t) => ({
        id: t.id,
        task: t.task,
        owner: t.owner,
        deadline: t.deadline,
        status: t.status,
      }));
      const answer = await generateJsonWithFallback(
        JSON.stringify({ today, command, tasks: slim }, null, 2),
        commandSystemPrompt(today),
        { budgetMs: 20_000 },
      );
      if (answer.ok) {
        try {
          const plan = sanitizePlan(parseModelJson(answer.text), tasks);
          return NextResponse.json({ ...plan, offline: false, model: answer.model });
        } catch {
          // fall through to the local parser
        }
      }
      return NextResponse.json({
        ...parseCommandLocally(command, tasks, today),
        offline: true,
        reason: answer.ok ? "Gemini returned an unreadable answer" : answer.reason,
      });
    }

    if (mode === "digest") {
      const now = parseIso(today);
      const facts = buildPersonFacts(tasks, previousDecisions, now);
      const local = buildLocalDigest(tasks, previousDecisions, now);
      if (facts.length === 0) {
        return NextResponse.json({ digests: [], generatedLocally: true });
      }
      const payload = facts.map((f) => ({
        person: f.person,
        openTasks: f.open.map((t) => ({ task: t.task.replace(/[.\s]+$/, ""), due: t.deadline ? formatDate(t.deadline) : "no date" })),
        overdueTasks: f.overdue.map((t) => t.task.replace(/[.\s]+$/, "")),
        doneTasks: f.done.map((t) => t.task.replace(/[.\s]+$/, "")),
      }));
      const answer = await generateJsonWithFallback(
        JSON.stringify({ today, people: payload }, null, 2),
        digestSystemPrompt(today),
        { budgetMs: 12_000 },
      );
      let aiUsed = 0;
      let byPerson = new Map<string, string>();
      if (answer.ok) {
        try {
          const parsed = parseModelJson(answer.text) as { summaries?: unknown };
          const list = Array.isArray(parsed.summaries) ? parsed.summaries : [];
          byPerson = new Map(
            list
              .filter((s): s is { person: string; summary: string } =>
                Boolean(s) && typeof (s as { person?: unknown }).person === "string",
              )
              .map((s) => [s.person, s.summary]),
          );
        } catch {
          // keep the fact-based summaries
        }
      }
      const digests = local.map((d, i) => {
        const candidate = byPerson.get(d.person);
        if (summaryIsFaithful(candidate, facts[i])) {
          aiUsed += 1;
          return { ...d, summary: (candidate as string).trim() };
        }
        return d;
      });
      return NextResponse.json({ digests, generatedLocally: aiUsed === 0 });
    }

    const systemInstruction = extractSystemPrompt(today);

    if (!transcript.trim()) {
      return jsonError("Paste a transcript before analyzing.", 400);
    }

    if (transcript.length > 20_000) {
      return jsonError("Transcript is too long. Keep it under 20,000 characters.", 413);
    }

    const generated = await generateJsonWithFallback(
      JSON.stringify(
        {
          today,
          meetingTitle: body.meetingTitle ?? "",
          previousDecisions,
          transcript,
        },
        null,
        2,
      ),
      systemInstruction,
    );

    if (generated.ok) {
      try {
        const extract = asExtract(parseModelJson(generated.text));
        const trace = buildTrace(extract, previousDecisions.length, {
          model: generated.model,
          attempt: generated.attempt,
          originalTranscript: transcript,
        });
        return NextResponse.json({
          ...extract,
          fromCache: false,
          trace,
        });
      } catch {
        // invalid JSON: fall through to the labeled demo fallback
      }
    }

    const demo = matchDemoTranscript(transcript);
    if (demo) {
      const cached = getCachedDemoExtract(demo, previousDecisions, today);
      const trace = buildTrace(cached, previousDecisions.length, {
        fromCache: true,
        originalTranscript: transcript,
      });
      return NextResponse.json({
        ...cached,
        fromCache: true,
        fallbackReason: generated.ok ? "Gemini returned invalid JSON" : generated.reason,
        trace,
      });
    }

    return jsonError(FRIENDLY_BUSY, 503);
  } catch {
    return jsonError(FRIENDLY_BUSY, 503);
  }
}
