import { describe, expect, it } from "vitest";
import { Phase } from "@/generated/prisma/enums";
import { journeyFor, pendingTask, standingStatus } from "@/components/portal/Journey";

const base = { hasIntake: true, intakeSubmitted: true, sectionsDone: 5, sectionsTotal: 5, day30Due: false };

describe("the client's one task", () => {
  it("asks for nothing on a cancelled or closed project, even with day 30 due (D-01)", () => {
    expect(pendingTask(Phase.CANCELLED, { ...base, day30Due: true })).toBeNull();
    expect(pendingTask(Phase.CLOSED, { ...base, day30Due: true })).toBeNull();
    expect(pendingTask(Phase.CANCELLED, { ...base, intakeSubmitted: false, sectionsDone: 1 })).toBeNull();
  });

  it("asks for the day-30 check-in on a delivered project when it is due", () => {
    expect(pendingTask(Phase.DELIVERED, { ...base, day30Due: true })?.path).toBe("/day30");
    expect(pendingTask(Phase.DELIVERED, base)).toBeNull();
  });

  it("puts the questionnaire before everything else while it is open", () => {
    const t = pendingTask(Phase.AGREEMENT_SENT, { ...base, intakeSubmitted: false, sectionsDone: 2 });
    expect(t?.path).toBe("/intake");
    expect(t?.cta).toBe("Carry on");
  });

  it("names the agreement and the review, and nothing while we build", () => {
    expect(pendingTask(Phase.AGREEMENT_SENT, base)?.path).toBe("/agreement");
    expect(pendingTask(Phase.IN_REVIEW, base)?.path).toBe("/review");
    expect(pendingTask(Phase.BUILDING, base)).toBeNull();
    expect(pendingTask(Phase.AGREED, base)).toBeNull();
  });
});

describe("where things stand", () => {
  it("says a cancelled project was closed, with the date, and never the reason", () => {
    const s = standingStatus(Phase.CANCELLED, { hasIntake: true, intakeSubmitted: true, endedOn: "11 September 2026" });
    expect(s.title).toBe("This project was closed on 11 September 2026");
    expect(s.detail).not.toMatch(/reason|why/i);
  });

  it("tells a brand new client what is happening before the questionnaire is up", () => {
    // The first screen most clients ever open: the project exists, the
    // questionnaire does not. It used to fall through to a do-nothing line.
    for (const phase of [null, Phase.INTAKE]) {
      const s = standingStatus(phase, { hasIntake: false, intakeSubmitted: false });
      expect(s.title).toBe("Nothing needed from you yet");
      expect(s.detail).toMatch(/questionnaire/i);
    }
  });

  it("never repeats the card's own label back as its heading", () => {
    const seen = [
      standingStatus(null, { hasIntake: false, intakeSubmitted: false }),
      standingStatus(Phase.INTAKE, { hasIntake: false, intakeSubmitted: false }),
      standingStatus(Phase.AGREEMENT_DRAFT, { hasIntake: true, intakeSubmitted: true }),
      standingStatus(Phase.AGREED, { hasIntake: true, intakeSubmitted: true }),
      standingStatus(Phase.BUILDING, { hasIntake: true, intakeSubmitted: true }),
    ];
    for (const s of seen) expect(s.title.toLowerCase()).not.toBe("where things stand");
  });

  it("has a line for every phase that has no task", () => {
    for (const phase of [null, Phase.AGREEMENT_DRAFT, Phase.AGREED, Phase.BUILDING, Phase.DELIVERED, Phase.CLOSED]) {
      const s = standingStatus(phase, { hasIntake: true, intakeSubmitted: true });
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.detail.length).toBeGreaterThan(0);
    }
  });
});

describe("the journey row", () => {
  it("is absent for a cancelled project and complete for a closed one", () => {
    expect(journeyFor(Phase.CANCELLED, { intakeSubmitted: true, day30Done: false })).toBeNull();
    expect(journeyFor(Phase.CLOSED, { intakeSubmitted: true, day30Done: false })).toEqual({ now: null, done: ["questionnaire", "agreement", "build", "delivery", "month"] });
  });
});
