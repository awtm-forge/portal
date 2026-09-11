import { Phase } from "@/generated/prisma/enums";

/**
 * Who a project is waiting on, and for what, from facts already on the record
 * (F-20). Pure, so the dashboard and the project page say the same thing and
 * a test can pin every phase. "Since" is the date the wait started, for the
 * "waiting on the client since 4 Sept" line.
 */
export type WaitingFacts = {
  phase: Phase;
  createdAt: Date;
  intakeUploadedAt: Date | null;
  intakeSubmittedAt: Date | null;
  agreementSentAt: Date | null;
  agreementAgreedAt: Date | null;
  kickoffAt: Date | null;
  lastUpdateSentAt: Date | null;
  openRoundSentAt: Date | null;
  deliveredAt: Date | null;
  day30UnlocksAt: Date | null;
  day30AnsweredAt: Date | null;
};

export type Waiting = { on: "client" | "us" | "nobody"; what: string; since: Date | null };

export const WAITING_LABEL: Record<Waiting["on"], string> = { client: "the client", us: "us", nobody: "nobody" };

export function waitingOn(f: WaitingFacts, now: Date = new Date()): Waiting {
  switch (f.phase) {
    case Phase.CANCELLED:
      return { on: "nobody", what: "cancelled", since: null };
    case Phase.CLOSED:
      return { on: "nobody", what: "closed", since: null };
    case Phase.DELIVERED: {
      const unlocked = f.day30UnlocksAt !== null && f.day30UnlocksAt <= now;
      if (f.day30AnsweredAt) return { on: "nobody", what: "delivered, day 30 answered, can be closed", since: f.day30AnsweredAt };
      if (unlocked) return { on: "client", what: "the month-on check-in", since: f.day30UnlocksAt };
      return { on: "nobody", what: "delivered, day 30 opens later", since: f.deliveredAt };
    }
    case Phase.IN_REVIEW:
      return { on: "client", what: "checking the work", since: f.openRoundSentAt };
    case Phase.BUILDING:
      return { on: "us", what: "the weekly update", since: f.lastUpdateSentAt ?? f.kickoffAt ?? f.agreementAgreedAt };
    case Phase.AGREED:
      return { on: "us", what: "marking the kickoff", since: f.agreementAgreedAt };
    case Phase.AGREEMENT_SENT:
      return { on: "client", what: "agreeing to the plan", since: f.agreementSentAt };
    case Phase.AGREEMENT_DRAFT:
      return { on: "us", what: "writing the agreement", since: f.intakeSubmittedAt ?? f.createdAt };
    case Phase.INTAKE:
      if (!f.intakeUploadedAt) return { on: "us", what: "uploading the questionnaire", since: f.createdAt };
      if (!f.intakeSubmittedAt) return { on: "client", what: "the questionnaire", since: f.intakeUploadedAt };
      return { on: "us", what: "writing the agreement", since: f.intakeSubmittedAt };
  }
}
