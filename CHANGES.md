# New in this version
- Conflict resolution: Supersede old decision / Keep both / Reject new decision. Confirm is blocked until every conflict is resolved. Superseded decisions are struck through in Memory and are no longer used for conflict detection.
- Clarification agent: action items with no owner or date are flagged with a suggested question. Confirm warns once before creating them.
- Calendar reminders: Board has "Download calendar reminders (.ics)" (all-day events with a reminder one day before).
- Voice cleanup view: raw dictation with fillers and self-corrections highlighted, next to the cleaned transcript.
- API route rejects transcripts over 20,000 characters.

Files added: lib/conflicts.ts, lib/ics.ts, components/TranscriptCompare.tsx
Files changed: app/page.tsx, app/board/page.tsx, app/memory/page.tsx, app/api/analyze/route.ts, components/ConflictsBanner.tsx, lib/types.ts, lib/demoCache.ts
Keep your own .env.local (it is not in this zip).

# v3
- Fixed duplicate React keys in the Digest page.
- Confirming the same meeting twice no longer creates duplicate tasks or decisions.
- Board has a "Clear tasks" button for resetting the demo.
- When Gemini fails and the cached demo is shown, the page now says why ("Gemini said: ...") and the server terminal prints "[gemini] ..." lines (the API key is redacted).
- Meetings page: summary tiles (active/superseded decisions, open tasks, overdue), a 3-step "How it works" card for first-time visitors, and a live voice check that counts fillers and self-corrections while you dictate.

# v4
- The "Gemini said" line now lists every model that was tried and why it failed, e.g. "gemini-3.8-flash → 503 ... | gemini-2.0-flash → 404 ...".
- New command `npm run check-gemini`: lists the Gemini models your key can use, tests each one with a tiny request, and prints the GEMINI_MODEL line to use.

# v5
- Supersede / Reject now work even when live Gemini words a conflict differently from the stored decision (word-overlap matching).
- Meetings without a title are named "Meeting YYYY-MM-DD" instead of "Untitled meeting".

## v6
- Meetings draft (title, transcript, results, edits, conflict choices) is saved automatically, so it survives switching tabs and reloads. New "New meeting" button.
- Demo transcripts are generated from today's date, so they never go stale. Client sends its local date to the API.
- Cleaned transcript keeps one line per speaker.
- NEW Voice command box on the Board (Wispr Flow): "Priya finished the landing page" -> Gemini maps it to board changes -> you confirm -> Apply (with Undo). Offline rule-based fallback when Gemini is busy.
- UI: hero + 4-step progress, guided demo button, redesigned conflict cards (earlier -> now), avatars, sidebar counts, skeleton loading, saved-banner on Board, mobile layout fixed.

## v7
- Digest: facts (open/overdue/done, dates, active decisions) are computed from your data. Gemini only writes the short summary, and it is rejected if it contradicts the facts (e.g. claims "completed" for a task that is not done). Copy update + Open in email per person.
- Restated tasks no longer duplicate: a later meeting that mentions an existing task offers "Update existing task" (deadline/owner change, with a history note on the card) or "Create as new task".
- Fixed "Uh-huh" not being counted/highlighted in the voice cleanup panel.
- Prompt: hedged/conditional decisions ("unless legal flags something") become open questions or an unassigned action item.
- Memory, Digest and Board pages share the new header; Memory is newest-first with Active/Superseded pills and no developer wording.

## v8 (deploy-ready)
- Rate limit on /api/analyze (20/min per visitor, 600/hour overall) and input size caps.
- "Reset demo data" button in the hero (two-step) to rerun the demo from a clean start.
- Consistent date format everywhere; the digest summary now keeps human-readable dates.
- Real README, .env.example, share metadata.

## v9
- Memory check: a deterministic second layer behind Gemini. A new decision on the same subject with a different number/date (50k vs 80k, Nov 18 vs Dec 2) raises a conflict card labelled "caught by memory check", even if the model missed it. Same decision in different wording is recognised as a duplicate and not stored twice.
- Owner names are merged case-insensitively ("jordan" and "Jordan" are one person, also in the Digest).
- Voice commands: "next Friday" now means that day in the coming calendar week; Gemini gets a 20s budget; if the offline parser is used, the reason is shown.

## v10
- Demo meeting 1 self-correction now uses named weekdays (today+1 → today+2) so it works on any day of the week.
- Superseding a decision now also retires repeats of it and older decisions that disagree with the new one on the same subject.
- Memory page: "Memory needs tidying" notice with a one-click "Keep the newest, tidy the rest" button for old test data.
- Digest: task names are cleaned (no stray periods) and the AI summary talks about tasks only, since decisions are listed separately.
