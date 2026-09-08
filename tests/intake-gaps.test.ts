import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { readAnswers } from "@/modules/intake/answers";
import { saveAnswer } from "@/modules/intake/answers";
import { parseDocumentLoose } from "@/modules/intake/document";
import { upsertDocument } from "@/modules/intake/replace";
import { overrideIntakeGate, send } from "@/modules/agreements";

/**
 * INTAKE-SPEC section 14, the criteria that had no test when the acceptance
 * audit was written on 9 September 2026. Numbers 7, 8 and 11 here; 6 is an
 * HTTP question and lives in the end to end suite.
 */
const SLUG = "intake-gaps-test";
let projectId = "";
let intakeId = "";
let adminId = "";

async function seedDocument() {
  const raw = JSON.parse(await readFile(path.join("prisma", "seed", "intake-kavya-2026-08-18.json"), "utf8"));
  const doc = parseDocumentLoose(raw);
  if (!doc) throw new Error("the seed questionnaire no longer parses");
  return doc;
}

async function clearUp() {
  const where = `projectId IN (SELECT id FROM Project WHERE slug LIKE '${SLUG}-%')`;
  for (const table of ["Agreement", "AgreementNote", "Intake", "ActivityEvent"]) {
    await db.$executeRawUnsafe(`DELETE FROM \`${table}\` WHERE ${where}`);
  }
  await db.$executeRaw`DELETE FROM Project WHERE slug LIKE ${`${SLUG}-%`}`;
  await db.$executeRaw`DELETE FROM Client WHERE businessName = 'Intake Gaps Test'`;
}

beforeEach(async () => {
  await clearUp();
  const admin = await db.adminUser.findFirst({ orderBy: { createdAt: "asc" } });
  adminId = admin?.id ?? (await db.adminUser.create({
    data: { email: `gaps-${Date.now()}@example.invalid`, name: "Gaps", passwordHash: "x" },
  })).id;

  const client = await db.client.create({
    data: { businessName: "Intake Gaps Test", contactName: "T", contactPhone: "+910000000000", contactEmail: "t@example.test" },
  });
  const project = await db.project.create({
    data: {
      clientId: client.id,
      name: "Gaps",
      slug: `${SLUG}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      typeOfWork: "STORE",
      signoffPersonName: "T",
      signoffPersonEmail: "t@example.test",
      accessTokenHash: `test-${Math.random().toString(36).slice(2)}`,
    },
  });
  projectId = project.id;
  await upsertDocument(projectId, await seedDocument(), adminId);
  intakeId = (await db.intake.findUniqueOrThrow({ where: { projectId } })).id;
});

afterAll(async () => {
  await clearUp();
  await db.$disconnect();
});

describe("INTAKE-SPEC 14.8, an answer typed by the team", () => {
  it("is marked as ours, permanently, and a client answer is not", async () => {
    await saveAnswer(intakeId, "biz_what", "Home appliances, mostly white goods.", "team");
    await saveAnswer(intakeId, "biz_where", ["own_site", "amazon"], "client");

    const answers = readAnswers((await db.intake.findUniqueOrThrow({ where: { id: intakeId } })).answers);
    expect(answers.biz_what.entered_by).toBe("team");
    expect(answers.biz_where.entered_by).toBe("client");
  });

  it("stays ours even when the client edits it afterwards, unless they do", async () => {
    await saveAnswer(intakeId, "biz_what", "Typed from the call.", "team");
    await saveAnswer(intakeId, "biz_what", "Actually, it is this.", "client");
    const answers = readAnswers((await db.intake.findUniqueOrThrow({ where: { id: intakeId } })).answers);
    // Whoever wrote the words that are there is who it says. That is the point
    // of the mark: it describes the answer, not the history.
    expect(answers.biz_what.entered_by).toBe("client");
  });
});

describe("INTAKE-SPEC 14.11, replacing the questionnaire", () => {
  it("keeps every answer whose question still exists", async () => {
    await saveAnswer(intakeId, "biz_what", "Home appliances.", "client");
    await saveAnswer(intakeId, "biz_where", ["own_site", "amazon"], "client");
    await saveAnswer(intakeId, "biz_volume", "100_500", "client");

    await upsertDocument(projectId, await seedDocument(), adminId);

    const answers = readAnswers((await db.intake.findUniqueOrThrow({ where: { projectId } })).answers);
    expect(answers.biz_what.value).toBe("Home appliances.");
    expect(answers.biz_where.value).toEqual(["own_site", "amazon"]);
    expect(answers.biz_volume.value).toBe("100_500");
  });

  it("hides an answer whose question is gone rather than throwing it away", async () => {
    await saveAnswer(intakeId, "biz_what", "Home appliances.", "client");
    const doc = await seedDocument();
    doc.sections[0].questions = doc.sections[0].questions.filter((q) => q.key !== "biz_what");

    const { hidden } = await upsertDocument(projectId, doc, adminId);
    expect(hidden).toContain("biz_what");

    const row = await db.intake.findUniqueOrThrow({ where: { projectId } });
    // Still in the answers, so putting the question back brings it with it.
    expect(readAnswers(row.answers).biz_what.value).toBe("Home appliances.");
  });
});

describe("INTAKE-SPEC 14.7, the agreement gate", () => {
  it("refuses to send while the questionnaire is unsubmitted", async () => {
    await db.agreement.create({
      data: { projectId, scope: "s", deliverables: [], milestones: [], notIncluded: "", totalPaise: 1n,
              advancePct: 50, howWeWork: "", ifWeMiss: "", afterDeliveryOffer: "", internalNotes: "" },
    });
    const result = await send(projectId);
    expect(result.ok).toBe(false);
  });

  it("records who overrode it and when, rather than just letting it through", async () => {
    expect(await overrideIntakeGate(projectId, adminId)).toBe(true);
    const row = await db.intake.findUniqueOrThrow({ where: { projectId } });
    expect(row.overriddenAt).not.toBeNull();
    expect(row.overriddenById).toBe(adminId);

    await db.agreement.create({
      data: { projectId, scope: "s", deliverables: [], milestones: [], notIncluded: "", totalPaise: 1n,
              advancePct: 50, howWeWork: "", ifWeMiss: "", afterDeliveryOffer: "", internalNotes: "" },
    });
    expect((await send(projectId)).ok).toBe(true);
  });
});
