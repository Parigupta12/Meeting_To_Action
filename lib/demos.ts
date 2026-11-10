import { addDays, parseIso, startOfDay, toIsoDate } from "./dates";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function ordinal(n: number) {
  const suffix = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${suffix[(v - 20) % 10] || suffix[v] || suffix[0]}`;
}

/** "November 15th" */
export function longDate(date: Date) {
  return `${MONTHS[date.getMonth()]} ${ordinal(date.getDate())}`;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Wednesday" */
export function weekdayName(date: Date) {
  return WEEKDAYS[date.getDay()];
}

/** "Nov 5" */
export function shortDate(date: Date) {
  return `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
}

/**
 * Every demo date is computed from "today", so the demo always lives in the
 * future no matter which day a judge opens the app.
 */
export function demoDates(today: string | Date) {
  const base = startOfDay(typeof today === "string" ? parseIso(today) : today);
  const landing = addDays(base, 3);
  const launch = addDays(base, 11);
  const wrongLaunch = addDays(base, 16);
  const newLaunch = addDays(base, 25);
  // Self-correction with two named weekdays that are always in the next few days.
  const designWrong = addDays(base, 1);
  const designDay = addDays(base, 2);
  return {
    landing,
    launch,
    wrongLaunch,
    newLaunch,
    designDay,
    designWrong,
    iso: {
      landing: toIsoDate(landing),
      designDay: toIsoDate(designDay),
    },
    weekday: {
      designWrong: weekdayName(designWrong),
      designDay: weekdayName(designDay),
    },
    long: {
      landing: longDate(landing),
      launch: longDate(launch),
      wrongLaunch: longDate(wrongLaunch),
      newLaunch: longDate(newLaunch),
    },
    short: {
      landing: shortDate(landing),
    },
  };
}

export type DemoMeeting = { title: string; transcript: string };

export function buildDemo(n: 1 | 2, today: string | Date): DemoMeeting {
  const d = demoDates(today);
  if (n === 1) {
    return {
      title: "Launch planning",
      transcript: `Alex: Uh, okay, so, um, let's kick this off. I think we should lock the product launch for ${d.long.wrongLaunch} — no wait, ${d.long.launch}. Yeah, ${d.long.launch} is the date. Final.

Priya: Got it, got it. I'll, um, I'll own the landing page. Need it live by ${d.long.landing} so we have buffer before launch.

Jordan: And the marketing budget — let's cap it at fifty thousand. That's 50k max, no more, even if ads look tempting.

Alex: Yeah, 50k cap is final. Priya, landing page by ${d.short.landing}. Launch ${d.long.launch}. We good?

Priya: We're good. I'll ping design ${d.weekday.designWrong}, uh, I mean ${d.weekday.designDay}.

Jordan: Cool. No extra spend without coming back to this group.`,
    };
  }
  return {
    title: "Launch check-in",
    transcript: `Alex: Okay so, um, about the launch. ${d.long.launch} isn't going to work with engineering. Let's move it to Friday — no wait, let's go with ${d.long.newLaunch}. ${d.long.newLaunch} is the new launch date.

Jordan: Also the budget. 50k is too tight with the extra paid social. Raising the marketing cap to 80k. Eighty thousand.

Priya: Wait, so is the landing page still on me? And is ${d.short.landing} still the deadline?

Alex: Yeah Priya still owns the landing page. Keep ${d.long.landing} unless you tell us otherwise.

Jordan: Yeah. Launch ${d.long.newLaunch}, budget 80k. That's the new plan.

Alex: Uh-huh. Let's, let's treat that as locked unless legal flags something.`,
  };
}

const OPENINGS: Record<1 | 2, string> = {
  1: "alex: uh, okay, so, um, let's kick this off",
  2: "alex: okay so, um, about the launch.",
};

/** Recognises a demo transcript regardless of the dates inside it. */
export function matchDemoTranscript(transcript: string): 1 | 2 | null {
  const head = transcript
    .replace(/\r\n/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (head.startsWith(OPENINGS[1])) return 1;
  if (head.startsWith(OPENINGS[2])) return 2;
  return null;
}
