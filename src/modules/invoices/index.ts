/**
 * Invoice numbering and issue (PORTAL-SPEC 5.1 and 5.7, docs/SEQUENCES.md 4).
 *
 * The number is allocated inside the same transaction that writes the invoice,
 * behind a row lock on invoice_sequence. A rolled back transaction leaves
 * last_seq untouched, which is what makes "never skipped" true, and the unique
 * index on invoice.number is the backstop if this file is ever wrong.
 *
 * There is no public way to create an advance or a balance by hand. Both are
 * called only from the phase machine's side effects.
 */
import type { Prisma } from "@/generated/prisma/client";
import { InvoiceKind, InvoiceStatus } from "@/generated/prisma/enums";
import type { InvoiceModel } from "@/generated/prisma/models";
import { financialYear, fromIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { formatRupees, parseRupeesToPaise, splitAdvance } from "@/lib/money";
import { emit } from "@/modules/events";
import { chargesGst, company } from "@/modules/settings";

export type Tx = Prisma.TransactionClient;

/**
 * Allocates the next number for a prefix and financial year. Must run in a
 * transaction.
 *
 * One statement takes the row's exclusive lock and increments, creating the
 * row on the year's first invoice. An earlier version did INSERT IGNORE and
 * then SELECT ... FOR UPDATE, which deadlocked under load: the insert takes a
 * shared lock, the select wants to upgrade it, and two transactions holding
 * shared locks both waiting to upgrade is a deadlock. The parallel test in
 * tests/invoice-numbering.test.ts is what found it.
 *
 * The read that follows sees this transaction's own increment and no one
 * else's, because the row stays locked until commit. A rollback reverts the
 * increment, which is what makes "never skipped" true.
 */
export async function nextNumber(tx: Tx, prefix: string, at: Date): Promise<string> {
  const fy = financialYear(at);
  await tx.$executeRaw`
    INSERT INTO InvoiceSequence (prefix, fy, lastSeq) VALUES (${prefix}, ${fy}, 1)
    ON DUPLICATE KEY UPDATE lastSeq = lastSeq + 1`;
  const rows = await tx.$queryRaw<{ lastSeq: number }[]>`
    SELECT lastSeq FROM InvoiceSequence WHERE prefix = ${prefix} AND fy = ${fy}`;
  const seq = rows[0]?.lastSeq;
  if (typeof seq !== "number") throw new Error("invoice sequence row vanished mid transaction");
  return `${prefix}/${fy}/${String(seq).padStart(3, "0")}`;
}

type IssueInput = {
  projectId: string;
  kind: InvoiceKind;
  amountPaise: bigint;
  description: string;
  prefix: string;
  gstin: string | null;
  at?: Date;
};

/**
 * PORTAL-SPEC 5.8: no tax line until a GSTIN exists, so tax is zero and the
 * total equals the amount. Registering later changes this without a migration.
 */
export async function issue(tx: Tx, input: IssueInput): Promise<InvoiceModel> {
  const at = input.at ?? new Date();
  const number = await nextNumber(tx, input.prefix, at);
  const taxAmountPaise = 0n;
  return tx.invoice.create({
    data: {
      projectId: input.projectId,
      kind: input.kind,
      number,
      issuedAt: at,
      description: input.description.slice(0, 300),
      amountPaise: input.amountPaise,
      taxAmountPaise,
      totalPaise: input.amountPaise + taxAmountPaise,
    },
  });
}

/** The advance, from the agreement. Called only by the agreement sign-off. */
export async function issueAdvance(
  tx: Tx,
  args: { projectId: string; totalPaise: bigint; advancePct: number; prefix: string; gstin: string | null; at?: Date },
): Promise<InvoiceModel> {
  const { advance } = splitAdvance(args.totalPaise, args.advancePct);
  return issue(tx, {
    projectId: args.projectId,
    kind: InvoiceKind.ADVANCE,
    amountPaise: advance,
    description: `Advance, ${args.advancePct} percent of the agreed total`,
    prefix: args.prefix,
    gstin: args.gstin,
    at: args.at,
  });
}

/** The balance, from the agreement. Called only by the delivery sign-off. */
export async function issueBalance(
  tx: Tx,
  args: { projectId: string; totalPaise: bigint; advancePct: number; prefix: string; gstin: string | null; at?: Date },
): Promise<InvoiceModel> {
  const { balance } = splitAdvance(args.totalPaise, args.advancePct);
  return issue(tx, {
    projectId: args.projectId,
    kind: InvoiceKind.BALANCE,
    amountPaise: balance,
    description: "Balance, on sign-off of the delivery",
    prefix: args.prefix,
    gstin: args.gstin,
    at: args.at,
  });
}

/** What the caller needs to issue anything, read once. */
export async function issuingContext(): Promise<{ prefix: string; gstin: string | null; chargesGst: boolean }> {
  const c = await company();
  return { prefix: c.invoicePrefix, gstin: c.gstin, chargesGst: chargesGst(c) };
}

export type MarkPaidReason = "not_found" | "not_issued" | "bad_date" | "future" | "before_issue";
export type MarkPaidResult = { ok: true; projectId: string } | { ok: false; reason: MarkPaidReason };

/**
 * Invoices are paid by bank transfer and marked paid by hand: there is no
 * gateway (PORTAL-SPEC 2). Only the payment fields move. The number and the
 * amounts are held still by the guard in lib/db once the row exists, so a
 * mistake here cannot rewrite what was billed.
 *
 * The date is validated in here rather than in the action, so the rule holds
 * wherever it is called from and no route needs to read the invoice itself.
 */
export async function markPaid(
  invoiceId: string,
  args: { paidOn: string; reference: string; method: string },
): Promise<MarkPaidResult> {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return { ok: false, reason: "not_found" };
  if (invoice.status !== InvoiceStatus.ISSUED) return { ok: false, reason: "not_issued" };

  const paidAt = fromIsoDate(args.paidOn);
  if (!paidAt) return { ok: false, reason: "bad_date" };
  if (paidAt.getTime() > Date.now() + DAY) return { ok: false, reason: "future" };
  if (paidAt < startOfDay(invoice.issuedAt)) return { ok: false, reason: "before_issue" };

  // Conditional on it still being ISSUED, so two admins marking the same
  // invoice paid at once produce one payment and one event, not two.
  const moved = await db.invoice.updateMany({
    where: { id: invoiceId, status: InvoiceStatus.ISSUED },
    data: {
      status: InvoiceStatus.PAID,
      paidAt,
      paidReference: args.reference.trim().slice(0, 191) || null,
      paymentMethod: args.method.trim().slice(0, 191) || null,
    },
  });
  if (moved.count !== 1) return { ok: false, reason: "not_issued" };

  await emit({
    type: "invoice.paid",
    projectId: invoice.projectId,
    actor: "team",
    payload: {
      number: invoice.number,
      kind: invoice.kind,
      kindLabel: KIND_LABEL[invoice.kind],
      amount: formatRupees(invoice.totalPaise),
    },
  });
  return { ok: true, projectId: invoice.projectId };
}

const DAY = 24 * 60 * 60 * 1000;

/** Money landing on the day the invoice was raised is not "before" it. */
function startOfDay(at: Date): Date {
  const d = new Date(at);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

const KIND_LABEL: Record<InvoiceKind, string> = {
  [InvoiceKind.ADVANCE]: "Advance",
  [InvoiceKind.BALANCE]: "Balance",
  [InvoiceKind.OTHER]: "Extra",
};

export type RaiseOtherResult =
  | { ok: true; number: string }
  | { ok: false; reason: "no_project" | "bad_amount" | "no_description" };

/**
 * PORTAL-SPEC 5.1 and acceptance criterion 3: `other` is the only kind an
 * admin can raise by hand. The advance and the balance follow a sign-off and
 * nothing else, which is why neither issueAdvance nor issueBalance is exported
 * to anything a route can reach.
 */
export async function raiseOther(args: {
  projectId: string;
  description: string;
  rupees: string;
}): Promise<RaiseOtherResult> {
  const description = args.description.trim();
  if (!description) return { ok: false, reason: "no_description" };
  const amountPaise = parseRupeesToPaise(args.rupees);
  if (amountPaise === null || amountPaise <= 0n) return { ok: false, reason: "bad_amount" };

  const project = await db.project.findUnique({ where: { id: args.projectId } });
  if (!project) return { ok: false, reason: "no_project" };
  const ctx = await issuingContext();

  const invoice = await db.$transaction((tx) =>
    issue(tx, {
      projectId: project.id,
      kind: InvoiceKind.OTHER,
      amountPaise,
      description,
      prefix: ctx.prefix,
      gstin: ctx.gstin,
    }),
  );
  await emit({
    type: "invoice.issued",
    projectId: project.id,
    actor: "team",
    payload: {
      number: invoice.number,
      kind: InvoiceKind.OTHER,
      kindLabel: KIND_LABEL[InvoiceKind.OTHER],
      amount: formatRupees(invoice.totalPaise),
    },
  });
  return { ok: true, number: invoice.number };
}

/** Every invoice on a project, oldest first, for the admin and client lists. */
export function forProject(projectId: string) {
  return db.invoice.findMany({ where: { projectId }, orderBy: { issuedAt: "asc" } });
}

/** One invoice with what the print page needs around it. */
export function forPrint(invoiceId: string) {
  return db.invoice.findUnique({
    where: { id: invoiceId },
    include: { project: { include: { client: true } } },
  });
}
