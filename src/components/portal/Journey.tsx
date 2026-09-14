import { type Stage } from "@/content/client-home";
import { Phase } from "@/generated/prisma/enums";

/**
 * Which of the five stages the client is in, and which are behind them.
 *
 * The rail and the status card must never point at different stages, so this
 * answers the same question the copy resolver answers, from the same facts,
 * and tests/journey.test.ts walks every combination of them to prove the two
 * agree. They disagreed twice before that test existed (14 Sep).
 *
 * The phase column is not the whole truth here. What a client has not finished
 * outranks what we have done since: a questionnaire still open means that is
 * where they are, even if the agreement has already gone out.
 */
export type JourneyState = { now: Stage | null; done: Stage[] };

const ORDER: Stage[] = ["questionnaire", "agreement", "build", "delivery", "month"];

export type JourneyFacts = {
  /** They have a questionnaire and have not sent it. */
  questionnaireOpen: boolean;
  questionnaireSubmitted: boolean;
  day30Done: boolean;
};

/** Null for a cancelled project, which has no next. */
export function journeyFor(phase: Phase | null, facts: JourneyFacts): JourneyState | null {
  if (phase === Phase.CANCELLED) return null;
  if (facts.questionnaireOpen) return { now: "questionnaire", done: [] };

  const upTo = (n: number): Stage[] => ORDER.slice(0, n);
  const afterQuestionnaire: JourneyState = facts.questionnaireSubmitted
    ? { now: "agreement", done: upTo(1) }
    : { now: "questionnaire", done: [] };

  if (phase === null) return afterQuestionnaire;
  switch (phase) {
    case Phase.INTAKE:
      // Sent, but nothing moved on it yet. The questionnaire is behind them
      // whatever the column says.
      return afterQuestionnaire;
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
  }
}
