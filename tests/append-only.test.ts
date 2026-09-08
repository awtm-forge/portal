import { afterAll, describe, expect, it } from "vitest";
import { AppendOnly, db } from "@/lib/db";

/**
 * PORTAL-SPEC 5.12 and acceptance criterion 16. The guard is on the client, so
 * these hold for every caller, including one written later that does not know
 * the rule.
 */
afterAll(async () => {
  await db.$disconnect();
});

describe("append-only evidence", () => {
  it("refuses to update or delete a sign-off event", async () => {
    await expect(db.signoffEvent.update({ where: { id: "x" }, data: { actorName: "someone else" } })).rejects.toThrow(AppendOnly);
    await expect(db.signoffEvent.delete({ where: { id: "x" } })).rejects.toThrow(AppendOnly);
    await expect(db.signoffEvent.deleteMany({ where: { projectId: "x" } })).rejects.toThrow(AppendOnly);
    await expect(db.signoffEvent.updateMany({ where: {}, data: { actorName: "x" } })).rejects.toThrow(AppendOnly);
  });

  it("refuses to change or remove a client's agreement note", async () => {
    await expect(db.agreementNote.update({ where: { id: "x" }, data: { text: "tidied up" } })).rejects.toThrow(AppendOnly);
    await expect(db.agreementNote.delete({ where: { id: "x" } })).rejects.toThrow(AppendOnly);
  });

  it("refuses to delete an invoice, or to change its number or amounts", async () => {
    await expect(db.invoice.delete({ where: { id: "x" } })).rejects.toThrow(AppendOnly);
    await expect(db.invoice.update({ where: { id: "x" }, data: { number: "AWTM/26-27/999" } })).rejects.toThrow(AppendOnly);
    await expect(db.invoice.update({ where: { id: "x" }, data: { totalPaise: 1n } })).rejects.toThrow(AppendOnly);
  });

  it("keeps every review round: it can be answered, never removed", async () => {
    // A round is written to once, when the client answers it.
    await expect(
      db.reviewRound.update({ where: { id: "no-such-round" }, data: { clientNote: "the label is wrong" } }),
    ).rejects.not.toThrow(AppendOnly);
    await expect(db.reviewRound.delete({ where: { id: "x" } })).rejects.toThrow(AppendOnly);
    await expect(db.reviewRound.deleteMany({ where: { projectId: "x" } })).rejects.toThrow(AppendOnly);
  });

  it("refuses to remove a testimonial or a day 30 record", async () => {
    await expect(db.testimonial.delete({ where: { id: "x" } })).rejects.toThrow(AppendOnly);
    await expect(db.day30.delete({ where: { id: "x" } })).rejects.toThrow(AppendOnly);
  });

  it("allows a referral to be deleted, which is the one deliberate exception", async () => {
    // It holds a third party's name and contact and that person never
    // consented to being stored, so it can be removed on request. Reaches the
    // database and fails on the missing row, not on the guard.
    await expect(db.referral.delete({ where: { id: "no-such-referral" } })).rejects.not.toThrow(AppendOnly);
  });

  it("guards models that actually exist, so a rename cannot disarm them", async () => {
    // The guard's sets are string literals. If a model were renamed they would
    // silently stop protecting anything, which is what happened to ReviewRound
    // for three steps before the table existed.
    for (const model of ["signoffEvent", "agreementNote", "invoice", "reviewRound", "testimonial", "day30"] as const) {
      expect(db[model], `${model} is named in the guard but not in the schema`).toBeDefined();
    }
  });

  it("allows marking an invoice paid, which is the one thing that moves", async () => {
    // Reaches the database and fails on the missing row, not on the guard.
    await expect(
      db.invoice.update({ where: { id: "no-such-invoice" }, data: { status: "PAID", paidAt: new Date(), paidReference: "NEFT" } }),
    ).rejects.not.toThrow(AppendOnly);
  });
});
