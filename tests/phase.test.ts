import { describe, expect, it } from "vitest";
import { Phase } from "@/generated/prisma/enums";
import { IllegalTransition, TRANSITIONS, can, next, type PhaseEvent } from "@/modules/projects/phase";

const ALL_PHASES = Object.values(Phase);
const ALL_EVENTS: PhaseEvent[] = [
  "intake_submitted", "intake_overridden", "agreement_sent", "agreement_note", "agreement_agreed",
  "kickoff_done", "marked_ready", "changes_requested", "delivery_signed_off", "closed", "cancelled",
];

describe("phase machine, PORTAL-SPEC 5.2 and ADR 0005", () => {
  it("allows every transition in the spec", () => {
    const expected: [Phase, PhaseEvent, Phase][] = [
      [Phase.INTAKE, "intake_submitted", Phase.AGREEMENT_DRAFT],
      [Phase.INTAKE, "intake_overridden", Phase.AGREEMENT_DRAFT],
      [Phase.AGREEMENT_DRAFT, "agreement_sent", Phase.AGREEMENT_SENT],
      [Phase.AGREEMENT_SENT, "agreement_note", Phase.AGREEMENT_DRAFT],
      [Phase.AGREEMENT_SENT, "agreement_agreed", Phase.AGREED],
      [Phase.AGREED, "kickoff_done", Phase.BUILDING],
      [Phase.BUILDING, "marked_ready", Phase.IN_REVIEW],
      [Phase.IN_REVIEW, "changes_requested", Phase.BUILDING],
      [Phase.IN_REVIEW, "delivery_signed_off", Phase.DELIVERED],
      [Phase.DELIVERED, "closed", Phase.CLOSED],
    ];
    for (const [from, event, to] of expected) {
      expect(next(from, event).to, `${from} ${event}`).toBe(to);
    }
  });

  it("refuses every move that is not in the table", () => {
    let refused = 0;
    for (const from of ALL_PHASES) {
      for (const event of ALL_EVENTS) {
        if (can(from, event)) continue;
        expect(() => next(from, event)).toThrow(IllegalTransition);
        refused += 1;
      }
    }
    expect(refused).toBeGreaterThan(70);
  });

  it("reaches agreed and delivered only through a sign-off", () => {
    for (const t of TRANSITIONS) {
      if (t.to === Phase.AGREED || t.to === Phase.DELIVERED) expect(t.by).toBe("signoff");
    }
  });

  it("issues the advance only on agreement and the balance only on delivery", () => {
    const advance = TRANSITIONS.filter((t) => t.effects.includes("issue_advance_invoice"));
    const balance = TRANSITIONS.filter((t) => t.effects.includes("issue_balance_invoice"));
    expect(advance).toHaveLength(1);
    expect(balance).toHaveLength(1);
    expect(advance[0].event).toBe("agreement_agreed");
    expect(balance[0].event).toBe("delivery_signed_off");
  });

  it("attaches the delivery side effects to the delivery transition and nowhere else", () => {
    const delivery = TRANSITIONS.find((t) => t.event === "delivery_signed_off");
    expect(delivery?.effects.sort()).toEqual(["after_delivery", "issue_balance_invoice", "open_day30"]);

    // Criterion 2's negative half, at the table: neither of these costs a client
    // anything, so neither may carry an effect.
    for (const event of ["marked_ready", "changes_requested"] as const) {
      expect(TRANSITIONS.find((t) => t.event === event)?.effects).toEqual([]);
    }
    expect(TRANSITIONS.filter((t) => t.effects.includes("open_day30"))).toHaveLength(1);
  });

  it("can be cancelled from every phase before delivery, and none after", () => {
    for (const from of ALL_PHASES) {
      const allowed = can(from, "cancelled");
      const terminal: Phase[] = [Phase.DELIVERED, Phase.CLOSED, Phase.CANCELLED];
      const before = !terminal.includes(from);
      expect(allowed, `cancel from ${from}`).toBe(before);
    }
  });

  it("never moves backwards except the two the spec allows", () => {
    const order: Phase[] = [Phase.INTAKE, Phase.AGREEMENT_DRAFT, Phase.AGREEMENT_SENT, Phase.AGREED, Phase.BUILDING, Phase.IN_REVIEW, Phase.DELIVERED, Phase.CLOSED];
    const backwards = TRANSITIONS.filter((t) => {
      const a = order.indexOf(t.from);
      const b = order.indexOf(t.to);
      return a >= 0 && b >= 0 && b < a;
    });
    expect(backwards.map((t) => t.event).sort()).toEqual(["agreement_note", "changes_requested"]);
  });
});
