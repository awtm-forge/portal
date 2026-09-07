/**
 * The project phase machine (ADR 0005, PORTAL-SPEC 5.2, docs/DATA-MODEL.md).
 *
 * This table is the journey. Nothing else may write project.phase: a route
 * that wants to move a project calls transition(). Illegal moves throw rather
 * than silently doing nothing, because a screen that asks for an impossible
 * move is a bug, not a user error.
 *
 * Side effects belong to the transition, not to the screen that triggered it.
 * They are named here and run by the caller's transaction in modules that own
 * them, so that this file stays readable next to the spec.
 */
import { Phase } from "@/generated/prisma/enums";

export type PhaseEvent =
  | "intake_submitted"
  | "intake_overridden"
  | "agreement_sent"
  | "agreement_note"
  | "agreement_agreed"
  | "kickoff_done"
  | "marked_ready"
  | "changes_requested"
  | "delivery_signed_off"
  | "closed"
  | "cancelled";

export type SideEffect = "issue_advance_invoice" | "issue_balance_invoice" | "open_day30" | "after_delivery";

export type Transition = {
  from: Phase;
  event: PhaseEvent;
  to: Phase;
  effects: SideEffect[];
  /** What may cause this move. Sign-offs are the two that a client alone can cause. */
  by: "admin" | "client" | "signoff";
};

const CANCELLABLE: Phase[] = [
  Phase.INTAKE,
  Phase.AGREEMENT_DRAFT,
  Phase.AGREEMENT_SENT,
  Phase.AGREED,
  Phase.BUILDING,
  Phase.IN_REVIEW,
];

export const TRANSITIONS: Transition[] = [
  { from: Phase.INTAKE, event: "intake_submitted", to: Phase.AGREEMENT_DRAFT, effects: [], by: "client" },
  { from: Phase.INTAKE, event: "intake_overridden", to: Phase.AGREEMENT_DRAFT, effects: [], by: "admin" },
  { from: Phase.AGREEMENT_DRAFT, event: "agreement_sent", to: Phase.AGREEMENT_SENT, effects: [], by: "admin" },
  // CLAUDE.md 5.1: the client can push back without a code.
  { from: Phase.AGREEMENT_SENT, event: "agreement_note", to: Phase.AGREEMENT_DRAFT, effects: [], by: "client" },
  { from: Phase.AGREEMENT_SENT, event: "agreement_agreed", to: Phase.AGREED, effects: ["issue_advance_invoice"], by: "signoff" },
  { from: Phase.AGREED, event: "kickoff_done", to: Phase.BUILDING, effects: [], by: "admin" },
  { from: Phase.BUILDING, event: "marked_ready", to: Phase.IN_REVIEW, effects: [], by: "admin" },
  { from: Phase.IN_REVIEW, event: "changes_requested", to: Phase.BUILDING, effects: [], by: "client" },
  {
    from: Phase.IN_REVIEW,
    event: "delivery_signed_off",
    to: Phase.DELIVERED,
    effects: ["issue_balance_invoice", "open_day30", "after_delivery"],
    by: "signoff",
  },
  { from: Phase.DELIVERED, event: "closed", to: Phase.CLOSED, effects: [], by: "admin" },
  ...CANCELLABLE.map((from): Transition => ({ from, event: "cancelled", to: Phase.CANCELLED, effects: [], by: "admin" })),
];

export class IllegalTransition extends Error {
  constructor(readonly from: Phase, readonly event: PhaseEvent) {
    super(`A project in ${from} cannot ${event.replace(/_/g, " ")}.`);
    this.name = "IllegalTransition";
  }
}

export function find(from: Phase, event: PhaseEvent): Transition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.event === event);
}

export function can(from: Phase, event: PhaseEvent): boolean {
  return find(from, event) !== undefined;
}

/** The one way to work out the next phase. Throws on an illegal move. */
export function next(from: Phase, event: PhaseEvent): Transition {
  const t = find(from, event);
  if (!t) throw new IllegalTransition(from, event);
  return t;
}

/** Phases in which the client's questionnaire is still theirs to change. */
export const INTAKE_OPEN: Phase[] = [Phase.INTAKE, Phase.AGREEMENT_DRAFT, Phase.AGREEMENT_SENT];

export const PHASE_LABEL: Record<Phase, string> = {
  [Phase.INTAKE]: "Questionnaire",
  [Phase.AGREEMENT_DRAFT]: "Writing the agreement",
  [Phase.AGREEMENT_SENT]: "Agreement with the client",
  [Phase.AGREED]: "Agreed",
  [Phase.BUILDING]: "Building",
  [Phase.IN_REVIEW]: "With the client to review",
  [Phase.DELIVERED]: "Delivered",
  [Phase.CLOSED]: "Closed",
  [Phase.CANCELLED]: "Cancelled",
};
