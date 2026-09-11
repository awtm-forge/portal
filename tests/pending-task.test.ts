import { describe, expect, it } from "vitest";
import { Phase } from "@/generated/prisma/enums";
import { pendingTask, standingStatus } from "@/components/portal/Journey";

/**
 * Item 4: the client home leads with the one thing we need from them, and
 * item 2: there is always something to read about where things stand.
 */
describe("what we need from the client", () => {
  const base = { hasIntake: true, intakeSubmitted: false, sectionsDone: 0, sectionsTotal: 5, day30Due: false };

  it("is the questionnaire before it is sent, and says how far in they are", () => {
    expect(pendingTask(null, base)?.path).toBe("/intake");
    expect(pendingTask(null, base)?.cta).toBe("Start the questionnaire");
    const midway = pendingTask(null, { ...base, sectionsDone: 2 });
    expect(midway?.cta).toBe("Carry on");
    expect(midway?.detail).toContain("2 of 5");
  });

  it("is reading the agreement once it is sent", () => {
    const t = pendingTask(Phase.AGREEMENT_SENT, { ...base, intakeSubmitted: true });
    expect(t?.path).toBe("/agreement");
  });

  it("is checking the work in review, and the check-in at day 30", () => {
    expect(pendingTask(Phase.IN_REVIEW, { ...base, intakeSubmitted: true })?.path).toBe("/review");
    expect(pendingTask(Phase.DELIVERED, { ...base, intakeSubmitted: true, day30Due: true })?.path).toBe("/day30");
  });

  it("is nothing while we draft or build, and the status still explains it", () => {
    expect(pendingTask(Phase.AGREEMENT_DRAFT, { ...base, intakeSubmitted: true })).toBeNull();
    expect(pendingTask(Phase.BUILDING, { ...base, intakeSubmitted: true })).toBeNull();
    expect(standingStatus(Phase.BUILDING, { hasIntake: true, intakeSubmitted: true }).title).toMatch(/building/i);
    expect(standingStatus(null, { hasIntake: false, intakeSubmitted: false }).detail.length).toBeGreaterThan(20);
  });
})
