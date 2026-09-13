import { type Stage } from "@/content/client-home";
import { Phase } from "@/generated/prisma/enums";

/**
 * Which of the five stages the client is in, and which are behind them.
 *
 * This used to carry the rail component and the home page's copy as well. The
 * rail is now ProgressRail and every sentence is in src/content/client-home.ts,
 * so what is left here is the one thing it was always for: turning a phase
 * into a place on the journey.
 */
export type JourneyState = { now: Stage | null; done: Stage[] };

const ORDER: Stage[] = ["questionnaire", "agreement", "build", "delivery", "month"];

/** Null for a cancelled project, which has no next. */
export function journeyFor(phase: Phase | null, facts: { intakeSubmitted: boolean; day30Done: boolean }): JourneyState | null {
  const upTo = (n: number): Stage[] => ORDER.slice(0, n);
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
