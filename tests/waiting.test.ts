import { describe, expect, it } from "vitest";
import { Phase } from "@/generated/prisma/enums";
import { waitingOn, type WaitingFacts } from "@/modules/projects/waiting";

const d = (day: number) => new Date(Date.UTC(2026, 8, day));
const now = d(20);
const none: WaitingFacts = {
  phase: Phase.INTAKE,
  createdAt: d(1),
  intakeUploadedAt: null,
  intakeSubmittedAt: null,
  agreementSentAt: null,
  agreementAgreedAt: null,
  kickoffAt: null,
  lastUpdateSentAt: null,
  openRoundSentAt: null,
  deliveredAt: null,
  day30UnlocksAt: null,
  day30AnsweredAt: null,
};

describe("who a project is waiting on", () => {
  it("is us until the questionnaire is up, then the client until it is in", () => {
    expect(waitingOn(none, now)).toMatchObject({ on: "us", since: d(1) });
    expect(waitingOn({ ...none, intakeUploadedAt: d(2) }, now)).toMatchObject({ on: "client", what: "the questionnaire", since: d(2) });
    expect(waitingOn({ ...none, intakeUploadedAt: d(2), intakeSubmittedAt: d(5) }, now)).toMatchObject({ on: "us" });
  });

  it("follows the agreement: us to write it, the client to agree, us to kick off", () => {
    expect(waitingOn({ ...none, phase: Phase.AGREEMENT_DRAFT, intakeSubmittedAt: d(5) }, now)).toMatchObject({ on: "us", since: d(5) });
    expect(waitingOn({ ...none, phase: Phase.AGREEMENT_SENT, agreementSentAt: d(6) }, now)).toMatchObject({ on: "client", since: d(6) });
    expect(waitingOn({ ...none, phase: Phase.AGREED, agreementAgreedAt: d(7) }, now)).toMatchObject({ on: "us", since: d(7) });
  });

  it("is us for the weekly update, from the last one sent or the kickoff", () => {
    expect(waitingOn({ ...none, phase: Phase.BUILDING, kickoffAt: d(8) }, now)).toMatchObject({ on: "us", since: d(8) });
    expect(waitingOn({ ...none, phase: Phase.BUILDING, kickoffAt: d(8), lastUpdateSentAt: d(15) }, now)).toMatchObject({ on: "us", since: d(15) });
  });

  it("is the client during a review and for the month-on check-in once it opens", () => {
    expect(waitingOn({ ...none, phase: Phase.IN_REVIEW, openRoundSentAt: d(16) }, now)).toMatchObject({ on: "client", since: d(16) });
    expect(waitingOn({ ...none, phase: Phase.DELIVERED, deliveredAt: d(10), day30UnlocksAt: d(40) }, now)).toMatchObject({ on: "nobody" });
    expect(waitingOn({ ...none, phase: Phase.DELIVERED, deliveredAt: d(10), day30UnlocksAt: d(18) }, now)).toMatchObject({ on: "client", since: d(18) });
    expect(waitingOn({ ...none, phase: Phase.DELIVERED, deliveredAt: d(10), day30UnlocksAt: d(18), day30AnsweredAt: d(19) }, now)).toMatchObject({ on: "nobody" });
  });

  it("is nobody once it has ended", () => {
    expect(waitingOn({ ...none, phase: Phase.CLOSED }, now)).toMatchObject({ on: "nobody", what: "closed" });
    expect(waitingOn({ ...none, phase: Phase.CANCELLED }, now)).toMatchObject({ on: "nobody", what: "cancelled" });
  });
});
