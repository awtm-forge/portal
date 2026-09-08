import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { SignoffMethod, TestimonialMoment, TestimonialStatus } from "@/generated/prisma/enums";
import { addDays } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  DAY30_DAYS,
  approveTestimonial,
  draftTestimonial,
  draftTextForClient,
  forProject,
  isUnlocked,
  markOpened,
  open,
  setFrictionNotes,
  submit,
} from "@/modules/day30";

/**
 * PORTAL-SPEC 6.5 and acceptance criterion 10. The unlock is a comparison made
 * on read, so these tests move `unlocks_at` rather than waiting a month, which
 * is the point: there is no job to trigger.
 */
const SLUG = "day30-test";
let projectId = "";

async function freshProject(): Promise<string> {
  const client = await db.client.create({
    data: { businessName: "Day30 Test", contactName: "T", contactPhone: "+910000000000", contactEmail: "t@example.test" },
  });
  const project = await db.project.create({
    data: {
      clientId: client.id,
      name: "Day30",
      slug: `${SLUG}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      typeOfWork: "STORE",
      signoffPersonName: "T",
      signoffPersonEmail: "t@example.test",
      accessTokenHash: `test-${Math.random().toString(36).slice(2)}`,
      metricName: "Checkout completion",
      metricBaselineValue: "41 percent",
    },
  });
  return project.id;
}

async function clearUp() {
  const where = `projectId IN (SELECT id FROM Project WHERE slug LIKE '${SLUG}-%')`;
  for (const table of ["Testimonial", "Referral", "Day30", "ActivityEvent"]) {
    await db.$executeRawUnsafe(`DELETE FROM \`${table}\` WHERE ${where}`);
  }
  await db.$executeRaw`DELETE FROM Project WHERE slug LIKE ${`${SLUG}-%`}`;
  await db.$executeRaw`DELETE FROM Client WHERE businessName = 'Day30 Test'`;
}

/** Puts the unlock in the past without waiting thirty days. */
async function unlockNow() {
  await db.day30.updateMany({ where: { projectId }, data: { unlocksAt: addDays(new Date(), -1) } });
}

beforeEach(async () => {
  await clearUp();
  projectId = await freshProject();
  await open(db, projectId, new Date());
});

afterAll(async () => {
  await clearUp();
  await db.$disconnect();
});

describe("the unlock", () => {
  it("lands thirty days after delivery", async () => {
    const row = await forProject(projectId);
    const days = Math.round((row!.unlocksAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    expect(days).toBe(DAY30_DAYS);
  });

  it("is a comparison, not a job: nothing has to run for it to open", () => {
    const at = new Date("2026-10-09T00:00:00Z");
    expect(isUnlocked({ unlocksAt: at }, new Date("2026-10-08T23:59:59Z"))).toBe(false);
    expect(isUnlocked({ unlocksAt: at }, at)).toBe(true);
    expect(isUnlocked({ unlocksAt: at }, new Date("2026-11-01T00:00:00Z"))).toBe(true);
  });

  it("refuses the answer before the date, and takes it after", async () => {
    const early = await submit(projectId, { metricAfter: "63 percent", quote: "", useName: false, useLogo: false });
    expect(early).toEqual({ ok: false, reason: "not_open" });

    await unlockNow();
    const later = await submit(projectId, { metricAfter: "63 percent", quote: "", useName: false, useLogo: false });
    expect(later).toEqual({ ok: true });
  });

  it("records the first view, and does not move it on the second", async () => {
    await unlockNow();
    await markOpened(projectId);
    const first = (await forProject(projectId))!.openedAt;
    expect(first).not.toBeNull();
    await markOpened(projectId);
    expect((await forProject(projectId))!.openedAt).toEqual(first);
  });
});

describe("the number and the quote", () => {
  beforeEach(unlockNow);

  it("keeps the number and stamps when it arrived", async () => {
    await submit(projectId, { metricAfter: "63 percent", quote: "", useName: false, useLogo: false });
    const row = await forProject(projectId);
    expect(row!.metricAfterValue).toBe("63 percent");
    expect(row!.metricAfterSubmittedAt).not.toBeNull();
  });

  it("approves the quote, because approving it is what this page is for", async () => {
    await submit(projectId, { metricAfter: "63", quote: "It paid for itself by March.", useName: true, useLogo: false });
    const t = await db.testimonial.findFirst({ where: { projectId, moment: TestimonialMoment.DAY30 } });
    expect(t!.status).toBe(TestimonialStatus.APPROVED);
    expect(t!.approvedMethod).toBe(SignoffMethod.PORTAL);
    expect(t!.useName).toBe(true);
    expect(t!.useLogo).toBe(false);
  });

  it("takes an empty answer, because answering nothing is still answering", async () => {
    expect(await submit(projectId, { metricAfter: "", quote: "", useName: false, useLogo: false })).toEqual({ ok: true });
    const row = await forProject(projectId);
    expect(row!.metricAfterSubmittedAt).not.toBeNull();
    expect(row!.metricAfterValue).toBeNull();
    expect(await db.testimonial.count({ where: { projectId } })).toBe(0);
  });

  it("cannot be answered twice, and the second attempt changes nothing", async () => {
    await submit(projectId, { metricAfter: "63", quote: "First", useName: false, useLogo: false });
    const second = await submit(projectId, { metricAfter: "99", quote: "Second", useName: true, useLogo: true });
    expect(second).toEqual({ ok: false, reason: "already_answered" });

    const row = await forProject(projectId);
    expect(row!.metricAfterValue).toBe("63");
    const t = await db.testimonial.findFirst({ where: { projectId, moment: TestimonialMoment.DAY30 } });
    expect(t!.text).toBe("First");
  });

  it("records one answer when the button is pressed twice at once", async () => {
    const results = await Promise.all([
      submit(projectId, { metricAfter: "A", quote: "", useName: false, useLogo: false }),
      submit(projectId, { metricAfter: "B", quote: "", useName: false, useLogo: false }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.activityEvent.count({ where: { projectId, type: "day30.approved" } })).toBe(1);
  });
});

describe("the quote they wrote at delivery", () => {
  it("is what the day-30 box starts with, so they edit rather than start again", async () => {
    await draftTestimonial(projectId, TestimonialMoment.DELIVERY, "Rough but it works.");
    expect(await draftTextForClient(projectId)).toBe("Rough but it works.");
  });

  it("gives way to the day-30 one once that exists", async () => {
    await draftTestimonial(projectId, TestimonialMoment.DELIVERY, "Rough but it works.");
    await draftTestimonial(projectId, TestimonialMoment.DAY30, "Six weeks on, it holds.");
    expect(await draftTextForClient(projectId)).toBe("Six weeks on, it holds.");
  });

  it("is empty when they never wrote one", async () => {
    expect(await draftTextForClient(projectId)).toBe("");
  });

  it("can be approved by hand when they said yes on WhatsApp, and says so", async () => {
    await draftTestimonial(projectId, TestimonialMoment.DELIVERY, "Rough but it works.");
    await approveTestimonial(projectId, TestimonialMoment.DELIVERY, SignoffMethod.WHATSAPP);
    const t = await db.testimonial.findFirst({ where: { projectId, moment: TestimonialMoment.DELIVERY } });
    expect(t!.status).toBe(TestimonialStatus.APPROVED);
    expect(t!.approvedMethod).toBe(SignoffMethod.WHATSAPP);
  });
});

describe("friction notes", () => {
  it("are kept, and there is no client view that could carry them", async () => {
    await setFrictionNotes(projectId, "The logo round took three goes.");
    expect((await forProject(projectId))!.frictionNotes).toBe("The logo round took three goes.");
    const serializers = await import("@/modules/serializers");
    const view = serializers.day30ToClientView(
      (await forProject(projectId))!,
      { metricName: null, metricBaselineValue: null, metricBaselineCapturedAt: null },
    );
    expect(JSON.stringify(view)).not.toContain("three goes");
  });
});
