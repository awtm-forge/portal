import { describe, expect, it } from "vitest";
import { TEAM_TYPES, teamNotice, teamPath } from "@/modules/notifications/team";

/**
 * The team is told the same sentence twice: once by email, once in the admin's
 * own notification page (ADR 0020). One mapper feeds both, so this is what
 * stops them drifting apart.
 */
describe("what the team is told", () => {
  it("covers the client's moments and the money", () => {
    expect(teamNotice("intake.submitted", { projectName: "Store rebuild", businessName: "Kavya" }, "p1")?.subject)
      .toBe("Store rebuild: questionnaire sent");
    expect(teamNotice("agreement.agreed", { projectName: "Store rebuild", version: 1, total: "Rs 5,20,000", method: "PORTAL" }, "p1")?.body)
      .toContain("The advance invoice is raised");
    expect(teamNotice("delivery.signed_off", { projectName: "Store rebuild" }, "p1")?.subject).toBe("Store rebuild: delivered");
    expect(teamNotice("enquiry.received", { name: "Asha" }, null)?.subject).toBe("Enquiry from Asha");
  });

  it("says nothing about the team's own doing, because they were there", () => {
    for (const t of ["agreement.sent", "update.sent", "review.opened", "intake.change_opened", "referral.forgotten"] as const) {
      expect(teamNotice(t, {}, "p1"), t).toBeNull();
    }
  });

  it("every type the feed queries for actually produces a notice", () => {
    // Otherwise the bell counts events the page will not show, and the count
    // never reaches zero.
    for (const t of TEAM_TYPES) {
      expect(teamNotice(t, {}, "p1"), t).not.toBeNull();
    }
  });

  it("points at the place the thing is dealt with", () => {
    expect(teamPath("p1")).toBe("/admin/projects/p1");
    expect(teamPath(null, "c1")).toBe("/admin/clients/c1");
    expect(teamPath(null)).toBe("/admin");
    // A questionnaire ask has no project yet, so it goes to the client.
    expect(teamNotice("intake.change_asked", { businessName: "Kavya", clientId: "c1", note: "wrong platform" }, null)?.path)
      .toBe("/admin/clients/c1");
  });

  it("carries no money the client never saw, because payloads arrive serialized", () => {
    const n = teamNotice("agreement.agreed", { projectName: "P", version: 1, total: "Rs 5,20,000", method: "PORTAL" }, "p1");
    expect(JSON.stringify(n)).not.toContain("internal");
  });
});
