import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { InvoiceKind, InvoiceStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { isoDate } from "@/lib/dates";
import { markPaid, raiseOther } from "@/modules/invoices";

/**
 * PORTAL-SPEC 5.1 and 5.7, acceptance criteria 3 and 16. Marking paid is the
 * only thing that moves on an issued invoice, and `other` is the only kind an
 * admin can raise. Runs against MySQL, like every other rule test here.
 */

const SLUG = "invoices-test";
let projectId = "";

async function freshProject(): Promise<string> {
  const client = await db.client.create({
    data: {
      businessName: "Invoices Test",
      contactName: "T",
      contactPhone: "+910000000000",
      contactEmail: "t@example.test",
    },
  });
  const project = await db.project.create({
    data: {
      clientId: client.id,
      name: "Invoices",
      slug: `${SLUG}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      typeOfWork: "STORE",
      signoffPersonName: "T",
      signoffPersonEmail: "t@example.test",
      accessTokenHash: `test-${Math.random().toString(36).slice(2)}`,
    },
  });
  return project.id;
}

/**
 * Raw SQL on purpose: the client refuses to delete an invoice (PORTAL-SPEC
 * 5.12) and this test has to undo its own rows. The sequence is left alone,
 * because a consumed number is never handed out again and that is the point.
 */
async function clearUp() {
  await db.$executeRaw`DELETE FROM Invoice WHERE projectId IN (SELECT id FROM Project WHERE slug LIKE ${`${SLUG}-%`})`;
  await db.$executeRaw`DELETE FROM ActivityEvent WHERE projectId IN (SELECT id FROM Project WHERE slug LIKE ${`${SLUG}-%`})`;
  await db.$executeRaw`DELETE FROM Project WHERE slug LIKE ${`${SLUG}-%`}`;
  await db.$executeRaw`DELETE FROM Client WHERE businessName = 'Invoices Test'`;
}

beforeEach(async () => {
  await clearUp();
  projectId = await freshProject();
});

afterAll(async () => {
  await clearUp();
  await db.$disconnect();
});

async function anInvoice(rupees = "10000") {
  const raised = await raiseOther({ projectId, description: "An extra", rupees });
  if (!raised.ok) throw new Error(`could not raise: ${raised.reason}`);
  const invoice = await db.invoice.findFirst({ where: { projectId }, orderBy: { issuedAt: "desc" } });
  if (!invoice) throw new Error("raised invoice vanished");
  return invoice;
}

const today = () => isoDate(new Date());

describe("raising an extra invoice", () => {
  it("is the only kind an admin can raise, and it gets a real number", async () => {
    const invoice = await anInvoice("2500.50");
    expect(invoice.kind).toBe(InvoiceKind.OTHER);
    expect(invoice.number).toMatch(/^[A-Z]+\/\d{2}-\d{2}\/\d{3}$/);
    expect(invoice.amountPaise).toBe(250050n);
    expect(invoice.totalPaise).toBe(250050n);
    expect(invoice.status).toBe(InvoiceStatus.ISSUED);
  });

  it("charges no tax until a GSTIN exists", async () => {
    // PORTAL-SPEC 5.8: the field is built now, the tax line appears later.
    const invoice = await anInvoice();
    expect(invoice.taxAmountPaise).toBe(0n);
    expect(invoice.totalPaise).toBe(invoice.amountPaise);
  });

  it("refuses an amount that is not money, or is nothing", async () => {
    for (const rupees of ["", "0", "-500", "nine hundred", "1,00,0.0.0"]) {
      const result = await raiseOther({ projectId, description: "An extra", rupees });
      expect(result, `accepted ${rupees}`).toEqual({ ok: false, reason: "bad_amount" });
    }
  });

  it("refuses a line the client would not understand, because they read it", async () => {
    const result = await raiseOther({ projectId, description: "   ", rupees: "1000" });
    expect(result).toEqual({ ok: false, reason: "no_description" });
  });

  it("refuses a project that is not there", async () => {
    const result = await raiseOther({ projectId: "nope", description: "An extra", rupees: "1000" });
    expect(result).toEqual({ ok: false, reason: "no_project" });
  });
});

describe("marking an invoice paid", () => {
  it("moves the payment fields and nothing else", async () => {
    const before = await anInvoice();
    const result = await markPaid(before.id, { paidOn: today(), reference: "NEFT/9912", method: "Bank transfer" });
    expect(result).toEqual({ ok: true, projectId });

    const after = await db.invoice.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.status).toBe(InvoiceStatus.PAID);
    expect(after.paidReference).toBe("NEFT/9912");
    expect(after.paymentMethod).toBe("Bank transfer");
    expect(after.paidAt).not.toBeNull();
    // What was billed does not move (criterion 16 and the guard in lib/db).
    expect(after.number).toBe(before.number);
    expect(after.amountPaise).toBe(before.amountPaise);
    expect(after.totalPaise).toBe(before.totalPaise);
    expect(after.description).toBe(before.description);
  });

  it("cannot be paid twice, and the second attempt changes nothing", async () => {
    const invoice = await anInvoice();
    await markPaid(invoice.id, { paidOn: today(), reference: "First", method: "Bank transfer" });
    const second = await markPaid(invoice.id, { paidOn: today(), reference: "Second", method: "Cash" });
    expect(second).toEqual({ ok: false, reason: "not_issued" });

    const after = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(after.paidReference).toBe("First");
    expect(after.paymentMethod).toBe("Bank transfer");
  });

  it("records one payment when two admins mark the same invoice at once", async () => {
    // The same lesson as the sign-off: the check and the write have to be one
    // statement, or two callers both pass the check on their own snapshot.
    const invoice = await anInvoice();
    const results = await Promise.all([
      markPaid(invoice.id, { paidOn: today(), reference: "A", method: "Bank transfer" }),
      markPaid(invoice.id, { paidOn: today(), reference: "B", method: "Bank transfer" }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);

    const events = await db.activityEvent.count({ where: { projectId, type: "invoice.paid" } });
    expect(events).toBe(1);
  });

  it("refuses a date before the invoice was raised, or one in the future", async () => {
    const invoice = await anInvoice();
    const yesterday = isoDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000));
    const nextWeek = isoDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    expect(await markPaid(invoice.id, { paidOn: yesterday, reference: "", method: "" })).toEqual({
      ok: false,
      reason: "before_issue",
    });
    expect(await markPaid(invoice.id, { paidOn: nextWeek, reference: "", method: "" })).toEqual({
      ok: false,
      reason: "future",
    });
    const after = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(after.status).toBe(InvoiceStatus.ISSUED);
  });

  it("takes money that landed on the day it was raised", async () => {
    const invoice = await anInvoice();
    const result = await markPaid(invoice.id, { paidOn: isoDate(invoice.issuedAt), reference: "", method: "" });
    expect(result.ok).toBe(true);
  });

  it("refuses a date it cannot read, and an invoice that is not there", async () => {
    const invoice = await anInvoice();
    expect(await markPaid(invoice.id, { paidOn: "yesterday", reference: "", method: "" })).toEqual({
      ok: false,
      reason: "bad_date",
    });
    expect(await markPaid("nope", { paidOn: today(), reference: "", method: "" })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("keeps an empty reference out of the record rather than storing a blank", async () => {
    const invoice = await anInvoice();
    await markPaid(invoice.id, { paidOn: today(), reference: "  ", method: "  " });
    const after = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(after.paidReference).toBeNull();
    expect(after.paymentMethod).toBeNull();
  });
});
