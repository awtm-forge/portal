import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { InvoiceKind } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { issue, nextNumber } from "@/modules/invoices";

/**
 * PORTAL-SPEC 5.7 and acceptance criterion 4. Runs against MySQL, never a
 * substitute: the whole point is InnoDB's row lock (ADR 0002).
 */

const PREFIX = "TEST";
let projectId = "";

async function freshProject(): Promise<string> {
  const client = await db.client.create({
    data: {
      businessName: "Numbering Test",
      contactName: "T",
      contactPhone: "+910000000000",
      contactEmail: "t@example.test",
      signoffPersonName: "T",
      signoffPersonEmail: "t@example.test",
    },
  });
  const project = await db.project.create({
    data: {
      clientId: client.id,
      name: "Numbering",
      slug: `numbering-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      typeOfWork: "STORE",
      accessTokenHash: `test-${Math.random().toString(36).slice(2)}`,
    },
  });
  return project.id;
}

/**
 * Cleanup goes through raw SQL on purpose: the client refuses to delete an
 * invoice (PORTAL-SPEC 5.12), and this test needs to undo its own rows. The
 * application has no such escape and tests/append-only.test.ts proves it.
 */
async function clearTestInvoices() {
  await db.$executeRaw`DELETE FROM Invoice WHERE number LIKE ${`${PREFIX}/%`}`;
  await db.$executeRaw`DELETE FROM InvoiceSequence WHERE prefix = ${PREFIX}`;
}

beforeEach(async () => {
  await clearTestInvoices();
  projectId = await freshProject();
});

afterAll(async () => {
  await clearTestInvoices();
  await db.$disconnect();
});

function issueOne(at: Date) {
  return db.$transaction(
    (tx) =>
      issue(tx, {
        projectId,
        kind: InvoiceKind.OTHER,
        amountPaise: 100000n,
        description: "concurrency",
        prefix: PREFIX,
        gstin: null,
        at,
      }),
    { timeout: 20000 },
  );
}

describe("invoice numbering", () => {
  it("starts a financial year at 001 and counts up", async () => {
    const at = new Date("2026-04-01T10:00:00+05:30");
    const a = await issueOne(at);
    const b = await issueOne(at);
    expect(a.number).toBe("TEST/26-27/001");
    expect(b.number).toBe("TEST/26-27/002");
  });

  it("starts a new sequence on 1 April and keeps the old year separate", async () => {
    const march = new Date("2027-03-31T23:00:00+05:30");
    const april = new Date("2027-04-01T00:30:00+05:30");
    const last = await issueOne(march);
    const first = await issueOne(april);
    expect(last.number).toBe("TEST/26-27/001");
    expect(first.number).toBe("TEST/27-28/001");
  });

  it("issues twenty in parallel with no duplicate and no gap", async () => {
    const at = new Date("2026-06-01T10:00:00+05:30");
    const issued = await Promise.all(Array.from({ length: 20 }, () => issueOne(at)));
    const seqs = issued.map((i) => Number(i.number.split("/")[2])).sort((a, b) => a - b);
    expect(new Set(seqs).size).toBe(20);
    expect(seqs).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("does not consume a number when the transaction rolls back", async () => {
    const at = new Date("2026-06-01T10:00:00+05:30");
    await issueOne(at);
    await expect(
      db.$transaction(async (tx) => {
        await nextNumber(tx, PREFIX, at);
        throw new Error("deliberate");
      }),
    ).rejects.toThrow("deliberate");
    const after = await issueOne(at);
    expect(after.number).toBe("TEST/26-27/002");
  });

  it("refuses a duplicate number at the database, not only in code", async () => {
    const at = new Date("2026-06-01T10:00:00+05:30");
    const first = await issueOne(at);
    await expect(
      db.invoice.create({
        data: {
          projectId,
          kind: InvoiceKind.OTHER,
          number: first.number,
          description: "duplicate",
          amountPaise: 1n,
          totalPaise: 1n,
        },
      }),
    ).rejects.toThrow();
  });
});
