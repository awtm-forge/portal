import { describe, expect, it } from "vitest";
import { clientNotice, DAY30_DUE } from "@/modules/notifications/client";

/**
 * Q19: the client is told about the moments that concern them, and only those.
 * Their own actions and the team's internal events produce nothing.
 */
describe("what the client is notified about", () => {
  it("is the agreement being ready, the work ready to check, a new update, and their questionnaire opened", () => {
    expect(clientNotice("agreement.sent", {})?.path).toBe("/agreement");
    expect(clientNotice("agreement.sent", {})?.email).toBe(true);
    expect(clientNotice("review.opened", {})?.path).toBe("/review");
    expect(clientNotice("update.sent", { weekNumber: 3 })?.title).toContain("week 3");
    expect(clientNotice("intake.change_opened", {})?.path).toBe("/intake");
  });

  it("is not their own actions or the team's own events", () => {
    for (const t of ["intake.submitted", "agreement.agreed", "delivery.signed_off", "thanks.sent", "review.changes_requested", "invoice.paid", "enquiry.received"] as const) {
      expect(clientNotice(t, {})).toBeNull();
    }
  });

  it("includes the month-on page opening, which is a date rather than an event (F-16)", () => {
    expect(DAY30_DUE.path).toBe("/day30");
    expect(DAY30_DUE.email).toBe(true);
    expect(DAY30_DUE.title).toMatch(/month/i);
  });
});
