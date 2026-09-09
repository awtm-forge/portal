import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Phase, SignoffMethod } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { agree } from "@/modules/agreements";
import { PhaseRaced, transition } from "@/modules/projects/phase";

/**
 * Acceptance criteria 1 and 6. Two people, or one person clicking twice, must
 * not be able to sign the same thing off twice: exactly one sign-off event and
 * exactly one invoice, whatever the timing.
 *
 * This is the test that justifies the conditional write in transition(). With
 * a plain update it fails, because both callers pass the phase check on their
 * own snapshot before either writes. Runs on MySQL, never a substitute
 * (ADR 0002): the whole point is InnoDB's locking behaviour.
 */
const SLUG_PREFIX = "concurrency-";

async function freshAgreedProject(): Promise<string> {
  const client = await db.client.create({
    data: {
      businessName: "Concurrency Test",
      contactName: "T",
      contactPhone: "+910000000000",
      contactEmail: "t@example.test",
      accessTokenHash: `conc-${Math.random().toString(36).slice(2)}`,
    },
  });
  const project = await db.project.create({
    data: {
      clientId: client.id,
      name: "Concurrency",
      slug: `${SLUG_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      typeOfWork: "STORE",
      signoffPersonName: "T",
      signoffPersonEmail: "t@example.test",
      phase: Phase.AGREEMENT_SENT,
      agreement: {
        create: {
          scope: "s",
          deliverables: [{ key: "d1", text: "A thing", how_to_check: "Look at it" }],
          notIncluded: "",
          milestones: [],
          totalPaise: 100000n,
          advancePct: 50,
          howWeWork: "",
          ifWeMiss: "",
          afterDeliveryOffer: "",
          internalNotes: "",
          sentAt: new Date(),
        },
      },
    },
  });
  return project.id;
}

async function clear() {
  await db.$executeRaw`DELETE FROM SignoffEvent WHERE projectId IN (SELECT id FROM Project WHERE slug LIKE ${`${SLUG_PREFIX}%`})`;
  await db.$executeRaw`DELETE FROM Invoice WHERE projectId IN (SELECT id FROM Project WHERE slug LIKE ${`${SLUG_PREFIX}%`})`;
  await db.$executeRaw`DELETE FROM Agreement WHERE projectId IN (SELECT id FROM Project WHERE slug LIKE ${`${SLUG_PREFIX}%`})`;
  await db.$executeRaw`DELETE FROM ActivityEvent WHERE projectId IN (SELECT id FROM Project WHERE slug LIKE ${`${SLUG_PREFIX}%`})`;
  await db.$executeRaw`DELETE FROM Project WHERE slug LIKE ${`${SLUG_PREFIX}%`}`;
  await db.$executeRaw`DELETE FROM Client WHERE businessName = 'Concurrency Test'`;
}

beforeEach(clear);

afterAll(async () => {
  await clear();
  await db.$disconnect();
});

describe("signing the same thing off twice", () => {
  it("writes one sign-off and one invoice when two calls race", async () => {
    const projectId = await freshAgreedProject();

    const results = await Promise.all([
      agree({ projectId, actorName: "One", method: SignoffMethod.WHATSAPP, rawNote: "ok done" }),
      agree({ projectId, actorName: "Two", method: SignoffMethod.WHATSAPP, rawNote: "ok done" }),
    ]);

    // One wins. The other either loses the phase race or finds it already agreed.
    expect(results.filter((r) => r.ok)).toHaveLength(1);

    const events = await db.signoffEvent.findMany({ where: { projectId } });
    const invoices = await db.invoice.findMany({ where: { projectId } });
    expect(events).toHaveLength(1);
    expect(invoices).toHaveLength(1);
    expect(invoices[0].kind).toBe("ADVANCE");

    const project = await db.project.findUnique({ where: { id: projectId } });
    expect(project?.phase).toBe(Phase.AGREED);
  });

  it("refuses a second sign-off made after the first has committed", async () => {
    const projectId = await freshAgreedProject();
    const first = await agree({ projectId, actorName: "One", method: SignoffMethod.PORTAL });
    expect(first.ok).toBe(true);

    const second = await agree({ projectId, actorName: "Two", method: SignoffMethod.PORTAL });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe("already_agreed");

    expect(await db.invoice.count({ where: { projectId } })).toBe(1);
  });
});

describe("transition", () => {
  it("refuses a move from a phase the project has already left", async () => {
    const projectId = await freshAgreedProject();
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error("missing");

    await transition(db, project, "agreement_agreed");
    // The caller still holds the stale phase it read a moment ago.
    await expect(transition(db, project, "agreement_agreed")).rejects.toThrow(PhaseRaced);

    const after = await db.project.findUnique({ where: { id: projectId } });
    expect(after?.phase).toBe(Phase.AGREED);
  });
});
