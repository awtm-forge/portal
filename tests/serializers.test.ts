import { describe, expect, it } from "vitest";
import type { AgreementModel } from "@/generated/prisma/models";
import { agreementToAdminView, agreementToClientView, agreementToPrintView } from "@/modules/serializers";

/**
 * Acceptance criterion 8 and ADR 0009, at the unit level. The e2e leak walk in
 * tests/e2e/leak-walk.spec.ts checks the same thing over real HTTP.
 */
const SECRET_COST = 210000000n;
const SECRET_NOTE = "Two developers for six weeks. Margin is thin.";

const agreement: AgreementModel = {
  id: "a1",
  projectId: "p1",
  scope: "A storefront.",
  deliverables: [{ key: "d1", text: "A storefront", how_to_check: "Open it" }],
  notIncluded: "Photography",
  startDate: new Date("2026-08-17T12:00:00Z"),
  launchTargetDate: new Date("2026-10-12T12:00:00Z"),
  milestones: [{ label: "Something you can open", date: "2026-08-28" }],
  totalPaise: 520000000n,
  advancePct: 50,
  howWeWork: "Weekly updates.",
  ifWeMiss: "We say so first.",
  afterDeliveryOffer: "A retainer.",
  internalCostPaise: SECRET_COST,
  internalNotes: SECRET_NOTE,
  sentAt: new Date("2026-08-14T10:00:00Z"),
  agreedAt: new Date("2026-08-15T09:12:00Z"),
  agreedByName: "Arjun Sundaram",
  agreedMethod: "PORTAL",
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function leaks(value: unknown): boolean {
  const text = JSON.stringify(value);
  return text.includes(SECRET_COST.toString()) || text.includes(SECRET_NOTE) || text.includes("internalCost") || text.includes("internalNotes");
}

describe("audience serializers", () => {
  it("gives the client view no internal cost and no internal notes", () => {
    expect(leaks(agreementToClientView(agreement))).toBe(false);
  });

  it("gives the print view none either", () => {
    expect(leaks(agreementToPrintView(agreement))).toBe(false);
  });

  it("has no key at all for an internal field in the client shape", () => {
    const keys = Object.keys(agreementToClientView(agreement));
    expect(keys.some((k) => k.toLowerCase().includes("internal"))).toBe(false);
    expect(keys.some((k) => k.toLowerCase().includes("margin"))).toBe(false);
  });

  it("shows the admin view the internal block, because that is its job", () => {
    const admin = agreementToAdminView(agreement);
    expect(admin.internalNotes).toBe(SECRET_NOTE);
    expect(admin.internalCost).toBe("Rs 21,00,000");
  });

  it("formats the split so the client sees advance and balance summing to the total", () => {
    const view = agreementToClientView(agreement);
    expect(view.total).toBe("Rs 52,00,000");
    expect(view.advance).toBe("Rs 26,00,000");
    expect(view.balance).toBe("Rs 26,00,000");
  });
});
