import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { DAYS, needsAttention } from "@/modules/projects/attention";

/**
 * PORTAL-SPEC 6.6. Six kinds of silence, each with a threshold, all worked out
 * on read. The tests move dates into the past rather than waiting, which is
 * the point: there is nothing to trigger.
 */
const SLUG = "attention-test";
let projectId = "";
let clientId = "";

async function anAdmin(): Promise<string> {
  const existing = await db.adminUser.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing.id;
  const made = await db.adminUser.create({
    data: { email: `attention-${Date.now()}@example.invalid`, name: "Attention", passwordHash: "x" },
  });
  return made.id;
}

async function anIntake(submitted = false) {
  await db.intake.create({
    data: {
      clientId,
      document: {},
      answers: {},
      accessGranted: {},
      hiddenQuestionKeys: [],
      sectionsDone: [],
      documentUploadedById: await anAdmin(),
      submittedAt: submitted ? new Date() : null,
    },
  });
}

async function freshProject(phase: string): Promise<string> {
  const client = await db.client.create({
    data: { businessName: "Attention Test", contactName: "T", contactPhone: "+910000000000", contactEmail: "t@example.test", accessTokenHash: `test-${Math.random().toString(36).slice(2)}` },
  });
  const project = await db.project.create({
    data: {
      clientId: client.id,
      name: "Attention",
      slug: `${SLUG}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      typeOfWork: "STORE",
      signoffPersonName: "T",
      signoffPersonEmail: "t@example.test",
    },
  });
  await db.$executeRawUnsafe(`UPDATE Project SET phase = ? WHERE id = ?`, phase, project.id);
  clientId = client.id;
  return project.id;
}

async function clearUp() {
  const where = `projectId IN (SELECT id FROM Project WHERE slug LIKE '${SLUG}-%')`;
  for (const table of ["Testimonial", "Referral", "Day30", "ActivityEvent", "ReviewRound", "Invoice", "Agreement", "Update"]) {
    await db.$executeRawUnsafe(`DELETE FROM \`${table}\` WHERE ${where}`);
  }
  // The questionnaire is the client's (ADR 0015), so it goes by client.
  await db.$executeRaw`DELETE FROM Intake WHERE clientId IN (SELECT id FROM Client WHERE businessName = 'Attention Test')`;
  await db.$executeRaw`DELETE FROM Project WHERE slug LIKE ${`${SLUG}-%`}`;
  await db.$executeRaw`DELETE FROM Client WHERE businessName = 'Attention Test'`;
}

/** Only what this test made. The seed project is not ours to assert about. */
async function mine() {
  const all = await needsAttention();
  return all.filter((a) => a.projectId === projectId || (a.projectId === null && a.clientId === clientId));
}

/** The questionnaire is counted from when it was sent, not from the project. */
async function ageQuestionnaire(days: number) {
  await db.$executeRawUnsafe(
    `UPDATE Intake SET documentUploadedAt = DATE_SUB(NOW(3), INTERVAL ? DAY) WHERE clientId = ?`, days, clientId,
  );
}

async function age(days: number) {
  await db.$executeRawUnsafe(
    `UPDATE Project SET createdAt = DATE_SUB(NOW(3), INTERVAL ? DAY) WHERE id = ?`, days, projectId,
  );
}

beforeEach(clearUp);
afterAll(async () => {
  await clearUp();
  await db.$disconnect();
});

describe("a questionnaire nobody filled in", () => {
  it("is quiet until the fifth day, and speaks up on it", async () => {
    projectId = await freshProject("INTAKE");
    await anIntake();

    await ageQuestionnaire(DAYS.intakeUnsubmitted - 1);
    expect(await mine()).toHaveLength(0);

    await ageQuestionnaire(DAYS.intakeUnsubmitted);
    const [item] = await mine();
    expect(item.reason).toBe("intake_unsubmitted");
    expect(item.line).toContain("still open");
  });

  it("goes quiet again once it is submitted", async () => {
    projectId = await freshProject("INTAKE");
    await anIntake(true);
    await age(30);
    expect(await mine()).toHaveLength(0);
  });
});

describe("an agreement nobody signed", () => {
  it("counts from when it was sent, not from when the project began", async () => {
    projectId = await freshProject("AGREEMENT_SENT");
    await db.agreement.create({
      data: { projectId, scope: "s", deliverables: [], milestones: [], notIncluded: "", totalPaise: 1n, advancePct: 50,
              howWeWork: "", ifWeMiss: "", afterDeliveryOffer: "", internalNotes: "" },
    });
    await age(90);

    await db.agreement.updateMany({ where: { projectId }, data: { sentAt: addDays(new Date(), -1) } });
    expect(await mine()).toHaveLength(0);

    await db.agreement.updateMany({ where: { projectId }, data: { sentAt: addDays(new Date(), -DAYS.agreementUnsigned) } });
    const [item] = await mine();
    expect(item.reason).toBe("agreement_unsigned");
  });
});

describe("a build with nothing said about it", () => {
  it("counts from the kickoff when no update has gone out", async () => {
    projectId = await freshProject("BUILDING");
    await db.project.update({ where: { id: projectId }, data: { kickoffAt: addDays(new Date(), -DAYS.noUpdateWhileBuilding) } });
    const [item] = await mine();
    expect(item.reason).toBe("no_update");
    expect(item.line).toContain("no update sent");
  });

  it("counts from the last update once one has", async () => {
    projectId = await freshProject("BUILDING");
    await db.project.update({ where: { id: projectId }, data: { kickoffAt: addDays(new Date(), -60) } });
    await db.update.create({
      data: { projectId, weekNumber: 1, moved: "m", nextUp: "n", needFromYou: "", risks: "r", sentAt: addDays(new Date(), -1) },
    });
    expect(await mine()).toHaveLength(0);

    await db.update.updateMany({ where: { projectId }, data: { sentAt: addDays(new Date(), -DAYS.noUpdateWhileBuilding) } });
    expect((await mine())[0].reason).toBe("no_update");
  });
});

describe("a review nobody answered", () => {
  it("speaks up on the third day", async () => {
    projectId = await freshProject("IN_REVIEW");
    await db.reviewRound.create({
      data: { projectId, roundNumber: 1, finishedWorkUrl: "https://example.test/x", sentAt: addDays(new Date(), -1) },
    });
    expect(await mine()).toHaveLength(0);

    await db.reviewRound.updateMany({ where: { projectId }, data: { sentAt: addDays(new Date(), -DAYS.reviewRoundOpen) } });
    expect((await mine())[0].reason).toBe("review_open");
  });
});

describe("an invoice nobody paid", () => {
  it("names the invoice, so it can be chased without opening the project", async () => {
    projectId = await freshProject("BUILDING");
    await db.project.update({ where: { id: projectId }, data: { kickoffAt: new Date() } });
    await db.invoice.create({
      data: { projectId, kind: "ADVANCE", number: "ATT/26-27/001", issuedAt: addDays(new Date(), -DAYS.invoiceUnpaid),
              description: "d", amountPaise: 100n, taxAmountPaise: 0n, totalPaise: 100n },
    });
    const [item] = await mine();
    expect(item.reason).toBe("invoice_unpaid");
    expect(item.line).toContain("ATT/26-27/001");
  });

  it("says nothing once it is paid", async () => {
    projectId = await freshProject("BUILDING");
    await db.project.update({ where: { id: projectId }, data: { kickoffAt: new Date() } });
    await db.invoice.create({
      data: { projectId, kind: "ADVANCE", number: "ATT/26-27/002", issuedAt: addDays(new Date(), -60),
              description: "d", amountPaise: 100n, taxAmountPaise: 0n, totalPaise: 100n, status: "PAID", paidAt: new Date() },
    });
    expect(await mine()).toHaveLength(0);
  });
});

describe("a day-30 page nobody opened", () => {
  it("speaks up the day it unlocks, and stops once it is seen", async () => {
    projectId = await freshProject("DELIVERED");
    await db.day30.create({ data: { projectId, unlocksAt: addDays(new Date(), -2), frictionNotes: "" } });
    expect((await mine())[0].reason).toBe("day30_unopened");

    await db.day30.updateMany({ where: { projectId }, data: { openedAt: new Date() } });
    expect(await mine()).toHaveLength(0);
  });

  it("says nothing before it unlocks", async () => {
    projectId = await freshProject("DELIVERED");
    await db.day30.create({ data: { projectId, unlocksAt: addDays(new Date(), 2), frictionNotes: "" } });
    expect(await mine()).toHaveLength(0);
  });
});

describe("what it leaves alone", () => {
  it("says nothing about a cancelled or a closed project", async () => {
    for (const phase of ["CANCELLED", "CLOSED"]) {
      projectId = await freshProject(phase);
      await anIntake();
      await age(90);
      expect(await mine(), phase).toHaveLength(0);
    }
  });

  it("puts the longest silence first, because that is the order to work in", async () => {
    projectId = await freshProject("BUILDING");
    await db.project.update({ where: { id: projectId }, data: { kickoffAt: addDays(new Date(), -10) } });
    await db.invoice.create({
      data: { projectId, kind: "ADVANCE", number: "ATT/26-27/003", issuedAt: addDays(new Date(), -40),
              description: "d", amountPaise: 100n, taxAmountPaise: 0n, totalPaise: 100n },
    });
    const items = await mine();
    expect(items).toHaveLength(2);
    expect(items[0].reason).toBe("invoice_unpaid");
    expect(items[0].days).toBeGreaterThan(items[1].days);
  });
});
