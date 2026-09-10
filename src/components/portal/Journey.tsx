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

export function Journey({ state }: { state: JourneyState }) {
  return (
    <ol className="journey" aria-label="Where you are">
      {STAGES.map((s) => {
        const kind = state.done.includes(s.key) ? "done" : s.key === state.now ? "now" : "later";
        return (
          <li key={s.key} className={kind} aria-current={kind === "now" ? "step" : undefined}>{s.label}</li>
        );
      })}
    </ol>
  );
}
