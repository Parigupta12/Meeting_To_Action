import { sameText } from "./conflicts";
import { demoDates } from "./demos";
import type { Conflict, ExtractResult, StoredDecision } from "./types";

export { matchDemoTranscript } from "./demos";

function meeting1Result(today: string): Omit<ExtractResult, "activity" | "trace"> {
  const dates = demoDates(today);
  return {
    cleanedTranscript: `Alex: Let's kick this off. We should lock the product launch for ${dates.long.launch}. ${dates.long.launch} is the date. Final.

Priya: Got it. I'll own the landing page. Need it live by ${dates.long.landing} so we have buffer before launch.

Jordan: And the marketing budget — let's cap it at fifty thousand. That's 50k max, no more, even if ads look tempting.

Alex: Yeah, 50k cap is final. Priya, landing page by ${dates.long.landing}. Launch ${dates.long.launch}. We good?

Priya: We're good. I'll ping design ${dates.weekday.designDay}.

Jordan: Cool. No extra spend without coming back to this group.`,
    decisions: [
      {
        id: "launch-date",
        text: `Lock the product launch for ${dates.long.launch}.`,
        owner: "Alex",
        quote: `${dates.long.launch} is the date. Final.`,
      },
      {
        id: "budget-cap",
        text: "Cap the marketing budget at $50,000. No extra spend without coming back to this group.",
        owner: "Jordan",
        quote: "That's 50k max, no more",
      },
    ],
    actionItems: [
      {
        id: "landing-page",
        task: "Ship the landing page live",
        owner: "Priya",
        deadline: dates.iso.landing,
        quote: `I'll own the landing page. Need it live by ${dates.long.landing}`,
      },
      {
        id: "ping-design",
        task: "Ping design about the landing page",
        owner: "Priya",
        deadline: dates.iso.designDay,
        quote: `I'll ping design ${dates.weekday.designWrong}, uh, I mean ${dates.weekday.designDay}.`,
      },
    ],
    openQuestions: [],
    conflicts: [],
  };
}

function meeting2Conflicts(previous: StoredDecision[], today: string): Conflict[] {
  const dates = demoDates(today);
  const newLaunch = `Move the product launch to ${dates.long.newLaunch}.`;
  const newBudget = "Raise the marketing budget cap to $80,000.";
  // Only flag a conflict when memory really holds an earlier, different decision.
  const launchEarlier =
    previous.find(
      (item) => /launch/i.test(item.text) && !sameText(item.text, newLaunch),
    ) ?? null;
  const budgetEarlier =
    previous.find(
      (item) =>
        /budget|50k|50,000/i.test(item.text) && !sameText(item.text, newBudget),
    ) ?? null;

  const conflicts: Conflict[] = [];
  if (launchEarlier) {
    conflicts.push({
      newDecision: newLaunch,
      earlierDecision: launchEarlier.text,
      earlierMeeting: launchEarlier.meetingTitle,
      explanation: `The launch date changed because ${dates.long.launch} will not work with engineering. It is now ${dates.long.newLaunch}.`,
      severity: "high",
    });
  }
  if (budgetEarlier) {
    conflicts.push({
      newDecision: newBudget,
      earlierDecision: budgetEarlier.text,
      earlierMeeting: budgetEarlier.meetingTitle,
      explanation:
        "The marketing cap was raised from $50,000 to $80,000 for extra paid social, reversing the earlier 50k limit.",
      severity: "high",
    });
  }
  return conflicts;
}

function meeting2Result(
  previous: StoredDecision[],
  today: string,
): Omit<ExtractResult, "activity" | "trace"> {
  const dates = demoDates(today);
  return {
    cleanedTranscript: `Alex: About the launch. ${dates.long.launch} isn't going to work with engineering. Let's go with ${dates.long.newLaunch}. ${dates.long.newLaunch} is the new launch date.

Jordan: Also the budget. 50k is too tight with the extra paid social. Raising the marketing cap to 80k.

Priya: Is the landing page still on me? And is ${dates.long.landing} still the deadline?

Alex: Yeah Priya still owns the landing page. Keep ${dates.long.landing} unless you tell us otherwise.

Jordan: Launch ${dates.long.newLaunch}, budget 80k. That's the new plan.

Alex: Let's treat that as locked unless legal flags something.`,
    decisions: [
      {
        id: "launch-date-v2",
        text: `Move the product launch to ${dates.long.newLaunch}.`,
        owner: "Alex",
        quote: `${dates.long.newLaunch} is the new launch date.`,
      },
      {
        id: "budget-cap-v2",
        text: "Raise the marketing budget cap to $80,000.",
        owner: "Jordan",
        quote: "Raising the marketing cap to 80k.",
      },
    ],
    actionItems: [
      {
        id: "landing-page-v2",
        task: "Keep the landing page on track for the original deadline",
        owner: "Priya",
        deadline: dates.iso.landing,
        quote: `Keep ${dates.long.landing} unless you tell us otherwise.`,
      },
      {
        id: "legal-check",
        task: "Confirm with legal that the new launch date can be locked",
        owner: "Unassigned",
        deadline: null,
        quote: "Let's treat that as locked unless legal flags something.",
      },
    ],
    openQuestions: [
      "Does legal need to flag anything before the new launch date is locked?",
    ],
    conflicts: meeting2Conflicts(previous, today),
  };
}

export function getCachedDemoExtract(
  demo: 1 | 2,
  previousDecisions: StoredDecision[],
  today: string,
): Omit<ExtractResult, "activity" | "trace"> {
  return demo === 1 ? meeting1Result(today) : meeting2Result(previousDecisions, today);
}
