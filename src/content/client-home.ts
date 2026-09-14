import { Phase } from "@/generated/prisma/enums";

/**
 * Every word the client's home page says about where things stand, in one
 * file, so the copy can be changed without opening a component (13 Sep).
 *
 * Rules for everything in here. Second person. Sentence case. Plain words, no
 * jargon, no exclamation marks. Say the date and say what happens next. Never
 * promise a date this file invented: a date only ever arrives as a fact from
 * the database, and where there is none the copy says we will message them.
 *
 * The chip is one of exactly three, and it answers one question: is anything
 * needed from you. "Done" means the whole job is finished, not that a stage
 * is, which is why an agreed agreement still reads "Nothing needed from you":
 * from the client's side that is the same sentence.
 */
export type Chip = "waiting" | "action" | "done";

export const CHIP_LABEL: Record<Chip, string> = {
  waiting: "Nothing needed from you",
  action: "Action needed",
  done: "Done",
};

export type Stage = "questionnaire" | "agreement" | "build" | "delivery" | "month";

/** The five stages, in order, in the words the client reads. */
export const STAGES: { key: Stage; label: string }[] = [
  { key: "questionnaire", label: "Questionnaire" },
  { key: "agreement", label: "Agreement" },
  { key: "build", label: "Build" },
  { key: "delivery", label: "Delivery" },
  // Was "A month on", which told a client nothing about what it asked of them.
  { key: "month", label: "Check-in" },
];

/**
 * What happens in a stage and roughly how long it takes. One source for both
 * the sentence the rail opens under a stage and the rows of "How this works",
 * so the two can never say different things about the same stage.
 */
export const STAGE_NOTES: Record<Stage, { what: string; how_long: string }> = {
  questionnaire: {
    what: "You tell us about your business in your own words, in a few short sections. It saves as you type, so you can stop and come back.",
    how_long: "About ten minutes",
  },
  agreement: {
    what: "We write one page: what we will build, what it costs, when it lands and how you will check it. You read it and agree to it once.",
    how_long: "About five minutes to read",
  },
  build: {
    what: "We build it. A short written update lands on this page every week whether or not anything went wrong, and either of us can book a call.",
    how_long: "The weeks in your agreement",
  },
  delivery: {
    what: "You check the finished work against what you agreed to. If something is off you say so and we keep going, as many rounds as it takes.",
    how_long: "A day or two to look it over",
  },
  month: {
    what: "A month after delivery we ask one number and one line about how it is going, then we leave you alone.",
    how_long: "Under a minute",
  },
};

/**
 * A block of home-page copy, resolved from facts.
 *
 * `expected` is a template, not a sentence: the page fills {date} with a real
 * date or drops the line entirely. `channel` is what we say instead of a date,
 * so a waiting client always knows how they will hear from us.
 *
 * `stage` is the stage the rail points at while this copy is showing, which is
 * not always the stage the words are about: after a delivery goes back for
 * changes the project is in the build again, and the rail should say so even
 * though the card is talking about the delivery. Its key names the moment; its
 * stage names the place.
 */
export type HomeCopy = {
  key: string;
  stage: Stage;
  chip: Chip;
  headline: string;
  body: string;
  expected?: string;
  action?: { label: string; path: string };
};

/**
 * The states this system can actually be in. Four of the twenty combinations
 * asked for are the same instant as another one here, and each says so where
 * it sits; a file of copy nothing can reach is copy that rots. The four are
 * recorded in docs/ux-overhaul/06-decision-log.md with what it would cost to
 * make them separate.
 */
export const HOME_STATES: Record<string, HomeCopy> = {
  // Questionnaire ---------------------------------------------------------
  "questionnaire.writing": {
    key: "questionnaire.writing",
    stage: "questionnaire",
    chip: "waiting",
    headline: "Nothing needed from you yet",
    body: "We are writing your questionnaire from what you told us on the call, so it asks about your business and nobody else's. It turns up on this page when it is ready.",
    expected: "We expect to have it with you by {date}.",
  },
  "questionnaire.ready": {
    key: "questionnaire.ready",
    stage: "questionnaire",
    chip: "action",
    headline: "Fill in your questionnaire",
    body: "A few short sections about your business, in your own words. It saves as you type, so you can stop and come back any time.",
    action: { label: "Open questionnaire", path: "/intake" },
  },
  "questionnaire.resumed": {
    key: "questionnaire.resumed",
    stage: "questionnaire",
    chip: "action",
    headline: "Finish your questionnaire",
    body: "You are {done} of {total} sections in. It saves as you type, so pick up where you left off.",
    action: { label: "Carry on where you left off", path: "/intake" },
  },
  // Submitted, and no project made yet. Once a project exists this same
  // moment is agreement.preparing, which is the truer thing to say then.
  "questionnaire.submitted": {
    key: "questionnaire.submitted",
    // Sent means the questionnaire is behind them and the agreement is next.
    stage: "agreement",
    chip: "waiting",
    headline: "Thank you, we have your answers",
    body: "We are reading them now and turning them into your agreement. Nothing else is needed from you until that is ready.",
    expected: "We expect to have it with you by {date}.",
  },

  // Agreement -------------------------------------------------------------
  "agreement.preparing": {
    key: "agreement.preparing",
    stage: "agreement",
    chip: "waiting",
    headline: "We are writing your agreement",
    body: "One page: what we will build, what it costs, when it lands and how you will check it. Nothing is invoiced until you have read it and agreed to it.",
    expected: "We expect to have it with you by {date}.",
  },
  "agreement.ready": {
    key: "agreement.ready",
    stage: "agreement",
    chip: "action",
    headline: "Read and agree to your plan",
    body: "One page, about five minutes. If anything is off, say so on the page and we will change it. Nothing is invoiced until you agree.",
    action: { label: "Review agreement", path: "/agreement" },
  },
  "agreement.changes": {
    key: "agreement.changes",
    stage: "agreement",
    chip: "waiting",
    headline: "We are changing your agreement",
    body: "We have what you said was off and we are working it in. The new version turns up on this page, and you read it again before anything starts.",
    expected: "We expect to have it back with you by {date}.",
  },
  "agreement.agreed": {
    key: "agreement.agreed",
    // Signed. The build is the stage they are in, even before it starts.
    stage: "build",
    chip: "waiting",
    headline: "Agreed, thank you",
    body: "We start shortly. Rahul will confirm the day we begin, and from then a short written update lands on this page every week.",
    expected: "We expect to start by {date}.",
  },

  // Build -----------------------------------------------------------------
  // One entry, not two. The build with a date and the build without one differ
  // by a single line, and the page drops that line when there is no date, so a
  // second block of identical copy would only be a second thing to keep true.
  "build.running": {
    key: "build.running",
    stage: "build",
    chip: "waiting",
    headline: "We are building it",
    body: "A short written update lands on this page every week, whether or not anything went wrong. You can reach us any time in between, and either of us can book a call.",
    expected: "The next thing you can open lands by {date}.",
  },
  // A build that stopped. This system has no pause: a project that stops has
  // been closed early, with the reason on the record, and saying "paused"
  // would promise a restart nothing can deliver.
  "build.stopped": {
    key: "build.stopped",
    stage: "build",
    chip: "waiting",
    headline: "This project was closed on {date}",
    body: "The reason is on the record, and everything below is still here to read. If that is a surprise, message Rahul and he will explain.",
  },

  // Delivery --------------------------------------------------------------
  "delivery.ready": {
    key: "delivery.ready",
    stage: "delivery",
    chip: "action",
    headline: "Check the finished work",
    body: "Have a look at it against what you agreed to, then sign it off or tell us what is off. Nothing is invoiced until you are happy with it.",
    action: { label: "Review delivery", path: "/review" },
  },
  // The delivery being prepared and the delivery sent back for changes are
  // the same state here: the phase returns to the build either way, and the
  // only honest difference is whether you asked for something.
  "delivery.changes": {
    key: "delivery.changes",
    // Back in the build, which is where the rail should point.
    stage: "build",
    chip: "waiting",
    headline: "We are making the changes you asked for",
    body: "We have your note. When it is ready you get another look, and as many rounds as it takes after that. Nothing is invoiced until you sign it off.",
    expected: "We expect to have it back with you by {date}.",
  },
  "delivery.done": {
    key: "delivery.done",
    stage: "delivery",
    chip: "done",
    headline: "It is done",
    body: "You signed it off, so the balance is invoiced and nothing else is needed from you. Everything below stays here to read.",
  },

  // Check-in --------------------------------------------------------------
  "month.waiting": {
    key: "month.waiting",
    stage: "month",
    chip: "waiting",
    headline: "One last thing, a month from now",
    body: "We come back once to ask how it is going: one number and one line, and then we leave you alone.",
    expected: "It opens on this page on {date}.",
  },
  "month.ready": {
    key: "month.ready",
    stage: "month",
    chip: "action",
    headline: "A quick month-on check-in",
    body: "One number and one line about how it has gone, and then we leave you alone. It takes under a minute.",
    action: { label: "Open the check-in", path: "/day30" },
  },
  "month.done": {
    key: "month.done",
    stage: "month",
    chip: "done",
    headline: "That is everything, thank you",
    body: "The work is delivered, the check-in is in, and this page stays here for as long as you want it. If anything comes up, message Rahul.",
  },
};

/** What the page knows. Every date is a fact from the database, already read. */
export type HomeFacts = {
  phase: Phase | null;
  hasQuestionnaire: boolean;
  questionnaireSubmitted: boolean;
  sectionsDone: number;
  sectionsTotal: number;
  /** The client asked for a change to the agreement and we have not re-sent it. */
  agreementChangeAsked: boolean;
  /** The client asked for changes to the delivery and we are making them. */
  deliveryChangeAsked: boolean;
  day30Due: boolean;
  day30Done: boolean;
  /** The check-in has a date and has not arrived yet. */
  checkinScheduled: boolean;
  ended: boolean;
};

/**
 * Which block of copy is true right now. Pure, so the whole table is testable
 * without a database: tests/client-home.test.ts walks every state.
 *
 * The order is the order of the rules, not of the stages. What the client owes
 * us outranks what we owe them, because that is the one thing they can act on.
 */
export function homeStateFor(f: HomeFacts): HomeCopy {
  if (f.day30Done || f.phase === Phase.CLOSED) return HOME_STATES["month.done"];
  if (f.ended) return HOME_STATES["build.stopped"];
  if (f.day30Due) return HOME_STATES["month.ready"];

  if (f.hasQuestionnaire && !f.questionnaireSubmitted) {
    return f.sectionsDone > 0 ? HOME_STATES["questionnaire.resumed"] : HOME_STATES["questionnaire.ready"];
  }
  if (f.phase === Phase.AGREEMENT_SENT) return HOME_STATES["agreement.ready"];
  if (f.phase === Phase.IN_REVIEW) return HOME_STATES["delivery.ready"];
  // Signed off. The next thing is the check-in, so the card says when that
  // opens; without a date to give it says the job is done and stops there.
  if (f.phase === Phase.DELIVERED) {
    return f.checkinScheduled ? HOME_STATES["month.waiting"] : HOME_STATES["delivery.done"];
  }

  if (!f.hasQuestionnaire && (f.phase === null || f.phase === Phase.INTAKE)) return HOME_STATES["questionnaire.writing"];
  // Their answers are in and nothing has moved on them yet: either no project
  // exists, or one does and it has not left the questionnaire phase. Both are
  // the same sentence to a client, and without this the second fell through to
  // "We are building it" while the rail still said Questionnaire (14 Sep).
  if (f.questionnaireSubmitted && (f.phase === null || f.phase === Phase.INTAKE)) return HOME_STATES["questionnaire.submitted"];
  if (f.phase === Phase.AGREEMENT_DRAFT || f.phase === null) {
    return f.agreementChangeAsked ? HOME_STATES["agreement.changes"] : HOME_STATES["agreement.preparing"];
  }
  if (f.phase === Phase.AGREED) return HOME_STATES["agreement.agreed"];
  if (f.phase === Phase.BUILDING) {
    if (f.deliveryChangeAsked) return HOME_STATES["delivery.changes"];
    return HOME_STATES["build.running"];
  }
  return HOME_STATES["build.running"];
}

/** Fill {date}, {done} and {total}. A placeholder with no value drops the line. */
export function fill(template: string, values: Record<string, string | number | null | undefined>): string | null {
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    if (out.includes(`{${key}}`)) {
      if (value === null || value === undefined || value === "") return null;
      out = out.replaceAll(`{${key}}`, String(value));
    }
  }
  return /\{[a-z]+\}/.test(out) ? null : out;
}
