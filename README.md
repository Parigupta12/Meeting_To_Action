# MeetingToAction

**Say it in the meeting. Watch it get done.**

A voice-first meeting-to-execution agent built for the Product Space × Wispr Flow *Agentic AI Hackathon '26* (Problem Statement 3: Meeting-to-Execution agent).

You dictate or paste a meeting transcript. Gemini cleans the speech, extracts decisions, action items, owners and deadlines, checks them against what the team decided in earlier meetings, and asks before it guesses. Nothing is saved until you confirm.

## What it does

| Problem statement requirement | How MeetingToAction does it |
|---|---|
| Transcript ingestion with speaker attribution | Paste or dictate `Speaker: text`. Every decision and task is attributed to the speaker, with a verbatim quote as evidence. |
| Extract decisions, action items, owners, deadlines | Gemini returns structured JSON. Relative dates ("Monday", "next Friday") are resolved against the person's local date. |
| Conflict detection against earlier decisions | Confirmed decisions live in Memory and are sent with every new analysis. A contradiction shows an *earlier → now* card, and you choose **Supersede**, **Keep both** or **Reject**. Replaced decisions stay in Memory, struck through. |
| Task creation via integration | A built-in task board (no external tracker yet). Restated tasks update the existing card instead of duplicating it. |
| Reminders | "Due in 48 hours" and "Overdue" panels, plus a one-click `.ics` calendar export with a reminder one day before each deadline. |
| Weekly digest per person | Task lists, dates and decisions are computed from real data. Gemini only writes the short summary, and it is rejected if it contradicts the facts. Copy or open in email. |
| Confirmation step before posting | Always on. Analysis only creates a draft. You edit it, resolve conflicts, then confirm. |

## What makes it different

- **It asks instead of guessing.** Missing owner or deadline? A "Needs clarification" panel appears with the exact question to ask the team.
- **Decision memory with a supersede chain.** Not just notes: the agent remembers what was decided and notices when a later meeting contradicts it.
- **Built for dictation.** It removes fillers and applies self-corrections ("Friday, no wait, Monday" becomes Monday). The raw-vs-cleaned view shows exactly what changed.
- **Voice commands on the board.** Dictate "Priya finished the landing page" and the agent proposes board changes. You review them, apply them, and can undo.
- **Honest AI.** The activity panel shows the model and attempt. If Gemini is unavailable, a clearly labeled cached demo result or an offline parser is used. The AI digest is validated against the facts before it is shown.

## Wispr Flow

The app is designed so that Wispr Flow is the input method:

1. Click the transcript box, hold the Wispr Flow hotkey and speak the meeting.
2. Click the Board's voice command box and say what changed.

Wispr Flow types into any focused field, so no special integration is needed. The app handles the imperfect text that dictation produces.

## How it works

```
Browser (Next.js App Router, React 19)
  Meetings page ── draft saved in localStorage ──┐
  Board / Memory / Digest ── localStorage ───────┤
                                                 ▼
                                      POST /api/analyze
                      modes: extract | digest | command
                                                 │
                 rate limit · size caps · model fallback list · retries
                                                 ▼
                                   Gemini (JSON mode)
                                                 │
            validation: schema checks, task ids, digest facts check
                                                 ▼
                          structured result → confirm step in the UI
```

Key files: `app/api/analyze/route.ts` (prompts and modes), `lib/gemini.ts` (retries, timeouts, fallback models), `lib/conflicts.ts` (supersede logic, clarification detection), `lib/commands.ts` (voice command planning and offline parser), `lib/digest.ts` (fact-checked digest), `lib/tasks.ts` (duplicate detection). Task creation currently writes to the built-in board.

## Run locally

Requirements: Node 20+ and a Gemini API key from Google AI Studio.

```bash
npm install
cp .env.example .env.local   # then put your key in .env.local
npm run dev
```

Open http://localhost:3000, click **Start guided demo**, then Analyze.

`npm run check-gemini` lists the models your key can use and tests which ones answer right now.

### Environment variables

| Name | Purpose |
|---|---|
| `GEMINI_API_KEY` | Your Gemini key (server only, never sent to the browser). |
| `GEMINI_MODEL` | Primary model, for example `gemini-3.5-flash`. |
| `GEMINI_FALLBACK_MODELS` | Comma-separated models tried in order if the primary is busy. |

## Deploy

Import the repository into Vercel, set the three environment variables above, and deploy. No database is needed.

## Limitations (honest list)

- Memory, tasks and drafts are stored in the browser (localStorage). Clearing site data clears them, and they are not shared between people.
- The board is built in. There is no external tracker connector yet (see the roadmap).
- Reminders are in-app panels and a calendar file, not push notifications.
- Rate limiting is per server instance, which is enough to protect the quota but not a security boundary.

## Roadmap

GitHub Issues / Linear / Jira connectors, shared team memory with sign-in, Slack delivery for the weekly digest, and direct audio upload.
