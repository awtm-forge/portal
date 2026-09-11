import { Phase } from "@/generated/prisma/enums";

/**
 * Where the client is in the whole thing, in five words. Not links: the row
 * of pages under the header is for going somewhere; this is for knowing what
 * comes next, which is the question clients ask most.
 */
export type Stage = "questionnaire" | "agreement" | "build" | "delivery" | "month";

const STAGES: { key: Stage; label: string }[] = [
  { key: "questionnaire", label: "Questionnaire" },
  { key: "agreement", label: "Agreement" },
  { key: "build", label: "Build" },
  { key: "delivery", label: "Delivery" },
  { key: "month", label: "A month on" },
];

export type JourneyState = { now: Stage | null; done: Stage[] };

/** Null for a cancelled project, which has no next. */
export function journeyFor(phase: Phase | null, facts: { intakeSubmitted: boolean; day30Done: boolean }): JourneyState | null {
  const upTo = (n: number): Stage[] => STAGES.slice(0, n).map((s) => s.key);
  if (phase === null) return facts.intakeSubmitted ? { now: "agreement", done: upTo(1) } : { now: "questionnaire", done: [] };
  switch (phase) {
    case Phase.INTAKE:
      return { now: "questionnaire", done: [] };
    case Phase.AGREEMENT_DRAFT:
    case Phase.AGREEMENT_SENT:
      return { now: "agreement", done: upTo(1) };
    case Phase.AGREED:
    case Phase.BUILDING:
      return { now: "build", done: upTo(2) };
    case Phase.IN_REVIEW:
      return { now: "delivery", done: upTo(3) };
    case Phase.DELIVERED:
      return facts.day30Done ? { now: null, done: upTo(5) } : { now: "month", done: upTo(4) };
    case Phase.CLOSED:
      return { now: null, done: upTo(5) };
    case Phase.CANCELLED:
      return null;
  }
}

/**
 * Five dots at every width. The labels sit beside them when there is room;
 * under 640 px the stylesheet tucks the labels away (still read out) and a
 * "Step 3 of 5, Build" line says it for sighted readers (F-03).
 */
export function Journey({ state }: { state: JourneyState }) {
  const nowIndex = STAGES.findIndex((s) => s.key === state.now);
  return (
    <div>
      <ol className="steps" aria-label="Where you are">
        {STAGES.map((s) => {
          const kind = state.done.includes(s.key) ? "done" : s.key === state.now ? "now" : "later";
          return (
            <li key={s.key} className={kind} aria-current={kind === "now" ? "step" : undefined}>
              <span className="dot" aria-hidden="true" />
              <span className="lbl">{s.label}</span>
            </li>
          );
        })}
      </ol>
      {nowIndex >= 0 ? (
        <p className="steps-now" aria-hidden="true">Step {nowIndex + 1} of {STAGES.length}, {STAGES[nowIndex].label}</p>
      ) : (
        <p className="steps-now" aria-hidden="true">All five steps done</p>
      )}
    </div>
  );
}

/**
 * The one thing, if anything, we are waiting on the client for (Q17). The
 * client home leads with this: a clear task with a plain instruction, or
 * nothing when the ball is in our court. There is never more than one, because
 * the phases are sequential, so the one-thing-to-do rule holds.
 *
 * A closed or cancelled project asks for nothing, whatever else is true of it
 * (D-01: the day-30 flag used to outrank the phase).
 */
export type PendingTask = { title: string; detail: string; path: string; cta: string; meta?: string };

export function pendingTask(
  phase: Phase | null,
  f: { hasIntake: boolean; intakeSubmitted: boolean; sectionsDone: number; sectionsTotal: number; day30Due: boolean },
): PendingTask | null {
  if (phase === Phase.CANCELLED || phase === Phase.CLOSED) return null;
  if (f.hasIntake && !f.intakeSubmitted) {
    const started = f.sectionsDone > 0;
    return {
      title: started ? "Finish your questionnaire" : "Fill in your questionnaire",
      detail: started
        ? `You are ${f.sectionsDone} of ${f.sectionsTotal} sections in. It saves as you type, so just pick up where you left off.`
        : "A few short sections about your business, in your own words. It saves as you type, so you can stop and come back any time.",
      path: "/intake",
      cta: started ? "Carry on" : "Start the questionnaire",
      meta: "About ten minutes",
    };
  }
  if (f.day30Due) {
    return { title: "A quick month-on check-in", detail: "One number and one line, and then we leave you alone.", path: "/day30", cta: "Open the check-in", meta: "Under a minute" };
  }
  if (phase === Phase.AGREEMENT_SENT) {
    return {
      title: "Read and agree to your plan",
      detail: "One page: what we will build, what it costs, when it lands, and how you will check it. If anything is off, say so on the page. Nothing is invoiced until you agree.",
      path: "/agreement",
      cta: "Read the agreement",
      meta: "About five minutes",
    };
  }
  if (phase === Phase.IN_REVIEW) {
    return {
      title: "Check the finished work",
      detail: "The work is ready. Have a look at it against what you agreed to, then sign it off or tell us what is off. Nothing is invoiced until you are happy.",
      path: "/review",
      cta: "Check the work",
    };
  }
  return null;
}

/**
 * What is happening when nothing is on the client. Plain, so the page is never
 * silent about where things stand (Q17, item 2: no screen without instruction).
 * Delivered and closed projects are not here: the delivered card on the home
 * page says it, with the date.
 */
export function standingStatus(
  phase: Phase | null,
  f: { hasIntake: boolean; intakeSubmitted: boolean; endedOn?: string },
): { title: string; detail: string } {
  if (!f.hasIntake && phase === null) {
    return { title: "Nothing needed from you yet", detail: "We are writing your questionnaire from what you told us on the call, so it asks about your business and no one else’s. It turns up here when it is ready, and we will message you." };
  }
  if (phase === null || phase === Phase.AGREEMENT_DRAFT) {
    return { title: "We are on it", detail: "We are turning your answers into your plan: what we will build, what it costs, when it lands, and how you will know it is done. It turns up here when it is ready, and we will message you." };
  }
  switch (phase) {
    case Phase.AGREED:
      return { title: "Agreed, thank you", detail: "We start shortly. Rahul will confirm the kickoff date with you, and a short written update lands here every week from then." };
    case Phase.BUILDING:
      return { title: "We are building it", detail: "A short written update lands here every week, whether or not anything went wrong. You can reach us any time in between." };
    case Phase.CANCELLED:
      return { title: f.endedOn ? `This project was closed on ${f.endedOn}` : "This project is closed", detail: "Everything below is still here to read. If that is a surprise, message Rahul and he will explain." };
    default:
      return { title: "Where things stand", detail: "Everything is on this page, and you can reach us any time." };
  }
}
