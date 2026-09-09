import { readFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { IntakeParty } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { saveAccess, saveAnswer, submitIntake } from "@/modules/intake/answers";
import { askForChange, declineChange, openForChanges, requestsFor, stateOf } from "@/modules/intake/changes";
import { changedKeys, LOCKED_MESSAGE, versionsFor } from "@/modules/intake/versions";

/**
 * ADR 0016 (QUESTIONS.md Q14). Sending the questionnaire locks it. A change
 * is asked for in a line, opened or declined by the team, and sent as the
 * next version. The access ticks stay live throughout, and nothing about a
 * version can be rewritten or removed.
 */
const BUSINESS = "Changes Test";
let clientId = "";
let intakeId = "";

async function anAdmin(): Promise<string> {
  const existing = await db.adminUser.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing.id;
  const made = await db.adminUser.create({ data: { email: `changes-${Date.now()}@example.invalid`, name: "Changes", passwordHash: "x" } });
  return made.id;
}

async function clearUp() {
  for (const table of ["IntakeChangeRequest", "IntakeVersion", "Intake", "ActivityEvent"]) {
    const column = table === "ActivityEvent" ? "payload->>'$.clientId'" : "clientId";
    await db.$executeRawUnsafe(`DELETE FROM \`${table}\` WHERE ${column} IN (SELECT id FROM Client WHERE businessName = ?)`, BUSINESS);
  }
  await db.$executeRaw`DELETE FROM Client WHERE businessName = ${BUSINESS}`;
}

async function freshIntake() {
  const document = JSON.parse(readFileSync("prisma/seed/intake-kavya-2026-08-18.json", "utf8"));
  const client = await db.client.create({
    data: { businessName: BUSINESS, contactName: "C", contactPhone: "+910000000001", contactEmail: "c@example.test", accessTokenHash: `changes-${Math.random().toString(36).slice(2)}` },
  });
  clientId = client.id;
  const at = new Date().toISOString();
  const intake = await db.intake.create({
    data: {
      clientId,
      document,
      answers: {
        biz_what: { value: "Kettles.", entered_by: "client", at },
        dec_signoff_name: { value: "C", entered_by: "client", at },
        dec_signoff_email: { value: "c@example.test", entered_by: "client", at },
      },
      accessGranted: {},
      hiddenQuestionKeys: [],
      sectionsDone: [],
      documentUploadedById: await anAdmin(),
    },
  });
  intakeId = intake.id;
}

beforeEach(async () => {
  await clearUp();
  await freshIntake();
});
afterAll(async () => {
  await clearUp();
  await db.$disconnect();
});

describe("what counts as a change", () => {
  it("is the answer, not when it was typed or by whom", () => {
    const before = { a: { value: "x", entered_by: "client", at: "1" }, b: { value: ["p"], entered_by: "client", at: "1" } };
    const after = { a: { value: "x", entered_by: "team", at: "2" }, b: { value: ["p", "q"], entered_by: "client", at: "2" }, c: { value: true, entered_by: "client", at: "2" } };
    expect(changedKeys(before, after)).toEqual(["b", "c"]);
    expect(changedKeys(after, before)).toEqual(["b", "c"]);
    expect(changedKeys(before, before)).toEqual([]);
  });
});

describe("sending locks the questionnaire", () => {
  it("makes version 1, then refuses every write but the access ticks", async () => {
    const sent = await submitIntake(intakeId);
    expect(sent.ok).toBe(true);
    const versions = await versionsFor(clientId);
    expect(versions.map((v) => v.version)).toEqual([1]);
    expect(versions[0].sentBy).toBe(IntakeParty.CLIENT);

    const write = await saveAnswer(intakeId, "biz_what", "Toasters.", "client");
    expect(write).toEqual({ ok: false, message: LOCKED_MESSAGE });
    const team = await saveAnswer(intakeId, "biz_what", "Toasters.", "team");
    expect(team).toEqual({ ok: false, message: LOCKED_MESSAGE });
    const again = await submitIntake(intakeId);
    expect(again).toEqual({ ok: false, message: LOCKED_MESSAGE });

    const tick = await saveAccess(intakeId, "acc_store", true);
    expect(tick.ok).toBe(true);

    expect(stateOf({ submittedAt: new Date() }, await requestsFor(clientId))).toEqual({ kind: "locked", declined: null });
  });
});

describe("asking to change it", () => {
  it("needs a line, needs a sent questionnaire, and is one at a time", async () => {
    expect(await askForChange(clientId, "  ")).toEqual({ ok: false, reason: "empty" });
    expect(await askForChange(clientId, "The email is wrong.")).toEqual({ ok: false, reason: "not_sent" });
    await submitIntake(intakeId);
    const first = await askForChange(clientId, "The email is wrong.");
    expect(first.ok).toBe(true);
    expect(await askForChange(clientId, "And the phone.")).toEqual({ ok: false, reason: "already_asked" });
    const state = stateOf({ submittedAt: new Date() }, await requestsFor(clientId));
    expect(state.kind).toBe("asked");
    if (state.kind === "asked") expect(state.request.note).toBe("The email is wrong.");
  });

  it("declining needs the line the client reads, and leaves it locked", async () => {
    await submitIntake(intakeId);
    const asked = await askForChange(clientId, "Change the platform.");
    if (!asked.ok) throw new Error(asked.reason);
    const admin = await anAdmin();
    expect(await declineChange(clientId, admin, asked.id, " ")).toEqual({ ok: false, reason: "empty_reply" });
    expect(await declineChange(clientId, admin, asked.id, "The agreement is already written from it. Tell us on the kickoff call.")).toEqual({ ok: true });
    const state = stateOf({ submittedAt: new Date() }, await requestsFor(clientId));
    expect(state.kind).toBe("locked");
    if (state.kind === "locked") expect(state.declined?.reply).toContain("kickoff call");
    expect(await saveAnswer(intakeId, "biz_what", "Toasters.", "client")).toEqual({ ok: false, message: LOCKED_MESSAGE });
    // They can ask again after a no.
    expect((await askForChange(clientId, "Just the email then.")).ok).toBe(true);
  });
});

describe("opening it and sending the changes", () => {
  it("lets writes through, then closes the request as version 2 naming what changed", async () => {
    await submitIntake(intakeId);
    const asked = await askForChange(clientId, "Kettles was wrong.");
    if (!asked.ok) throw new Error(asked.reason);
    const admin = await anAdmin();
    expect(await openForChanges(clientId, admin, asked.id)).toEqual({ ok: true });
    expect(await openForChanges(clientId, admin, null)).toEqual({ ok: false, reason: "already_open" });
    expect(stateOf({ submittedAt: new Date() }, await requestsFor(clientId)).kind).toBe("changing");

    expect((await saveAnswer(intakeId, "biz_what", "Toasters.", "client")).ok).toBe(true);
    // Saving the same value again is not a change.
    expect((await saveAnswer(intakeId, "dec_signoff_name", "C", "client")).ok).toBe(true);

    const sent = await submitIntake(intakeId);
    expect(sent.ok).toBe(true);
    const versions = await versionsFor(clientId);
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
    expect(versions[1].changed).toEqual(["biz_what"]);
    const [request] = await requestsFor(clientId);
    expect(request.status).toBe("SENT");
    expect(request.version).toBe(2);
    expect(stateOf({ submittedAt: new Date() }, await requestsFor(clientId))).toEqual({ kind: "locked", declined: null });
    expect(await saveAnswer(intakeId, "biz_what", "Kettles.", "client")).toEqual({ ok: false, message: LOCKED_MESSAGE });
  });

  it("the team can open it unasked and lock it again as the next version", async () => {
    await submitIntake(intakeId);
    const admin = await anAdmin();
    expect(await openForChanges(clientId, admin, null, "Typo from the call")).toEqual({ ok: true });
    expect((await saveAnswer(intakeId, "biz_what", "Kettles and toasters.", "team")).ok).toBe(true);
    const locked = await submitIntake(intakeId, IntakeParty.TEAM);
    expect(locked.ok).toBe(true);
    const versions = await versionsFor(clientId);
    expect(versions.map((v) => [v.version, v.sentBy])).toEqual([[1, "CLIENT"], [2, "TEAM"]]);
    const [request] = await requestsFor(clientId);
    expect(request.askedBy).toBe("TEAM");
    expect(request.status).toBe("SENT");
  });
});

describe("what cannot happen to a version", () => {
  it("is being rewritten or removed, and a request cannot be removed", async () => {
    await submitIntake(intakeId);
    const [v1] = await db.intakeVersion.findMany({ where: { clientId } });
    await expect(db.intakeVersion.update({ where: { id: v1.id }, data: { answers: {} } })).rejects.toThrow(/append/i);
    await expect(db.intakeVersion.delete({ where: { id: v1.id } })).rejects.toThrow(/append/i);
    const asked = await askForChange(clientId, "x");
    if (!asked.ok) throw new Error(asked.reason);
    await expect(db.intakeChangeRequest.delete({ where: { id: asked.id } })).rejects.toThrow(/append/i);
  });
});
