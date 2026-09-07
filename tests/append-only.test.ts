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

  it("allows marking an invoice paid, which is the one thing that moves", async () => {
    // Reaches the database and fails on the missing row, not on the guard.
    await expect(
      db.invoice.update({ where: { id: "no-such-invoice" }, data: { status: "PAID", paidAt: new Date(), paidReference: "NEFT" } }),
    ).rejects.not.toThrow(AppendOnly);
  });
});
