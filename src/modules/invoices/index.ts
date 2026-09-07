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
import { InvoiceKind } from "@/generated/prisma/enums";
import type { InvoiceModel } from "@/generated/prisma/models";
import { financialYear } from "@/lib/dates";
import { splitAdvance } from "@/lib/money";
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
  args: { projectId: string; projectName: string; totalPaise: bigint; advancePct: number; prefix: string; gstin: string | null; at?: Date },
): Promise<InvoiceModel> {
  const { advance } = splitAdvance(args.totalPaise, args.advancePct);
  return issue(tx, {
    projectId: args.projectId,
    kind: InvoiceKind.ADVANCE,
    amountPaise: advance,
    description: `${args.projectName}, advance (${args.advancePct} percent)`,
    prefix: args.prefix,
    gstin: args.gstin,
    at: args.at,
  });
}

/** The balance, from the agreement. Called only by the delivery sign-off. */
export async function issueBalance(
  tx: Tx,
  args: { projectId: string; projectName: string; totalPaise: bigint; advancePct: number; prefix: string; gstin: string | null; at?: Date },
): Promise<InvoiceModel> {
  const { balance } = splitAdvance(args.totalPaise, args.advancePct);
  return issue(tx, {
    projectId: args.projectId,
    kind: InvoiceKind.BALANCE,
    amountPaise: balance,
    description: `${args.projectName}, balance on delivery`,
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
