/**
 * Day 30, and the things the client gives back: the testimonial and the
 * referral (docs/ARCHITECTURE.md folder layout, CLAUDE.md 5.1).
 *
 * Step 8 uses `open`, called inside the delivery transaction, and the two
 * write functions the thank-you page needs. Step 10 added the unlock, the
 * metric and the client's own approval of their quote.
 */
import { SignoffMethod, TestimonialMoment, TestimonialStatus } from "@/generated/prisma/enums";
import type { Day30Model, ReferralModel, TestimonialModel } from "@/generated/prisma/models";
import { addDays } from "@/lib/dates";
import { emit } from "@/modules/events";
import { db } from "@/lib/db";
import type { Tx } from "@/modules/invoices";

export const DAY30_DAYS = 30;

/** PORTAL-SPEC 5.6. Created by the delivery sign-off, thirty days out. */
export async function open(tx: Tx, projectId: string, deliveredAt: Date): Promise<Day30Model> {
  return tx.day30.create({
    data: { projectId, unlocksAt: addDays(deliveredAt, DAY30_DAYS), frictionNotes: "" },
  });
}

/**
 * The client's words, drafted. One per moment, so editing a quote replaces it
 * rather than piling up. Permissions are asked at day 30, not at delivery, so
 * useName and useLogo stay false here.
 */
export async function draftTestimonial(
  projectId: string,
  moment: TestimonialMoment,
  text: string,
): Promise<TestimonialModel> {
  const trimmed = text.trim().slice(0, 4000);
  return db.testimonial.upsert({
    where: { projectId_moment: { projectId, moment } },
    create: { projectId, moment, text: trimmed, status: TestimonialStatus.DRAFT },
    update: { text: trimmed, status: TestimonialStatus.DRAFT, approvedAt: null, approvedMethod: null },
  });
}

export async function approveTestimonial(
  projectId: string,
  moment: TestimonialMoment,
  method: SignoffMethod,
): Promise<void> {
  await db.testimonial.updateMany({
    where: { projectId, moment },
    data: { status: TestimonialStatus.APPROVED, approvedAt: new Date(), approvedMethod: method },
  });
}

/** Admin only. There is deliberately no client-facing reader. */
export function testimonialsForAdmin(projectId: string) {
  return db.testimonial.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
}

/** The only reader anything outside admin may use. Criterion 26. */
export function approvedTestimonials(projectId: string) {
  return db.testimonial.findMany({
    where: { projectId, status: TestimonialStatus.APPROVED },
    orderBy: { createdAt: "asc" },
  });
}

export async function addReferral(projectId: string, name: string, contact: string): Promise<ReferralModel | null> {
  const n = name.trim().slice(0, 200);
  const c = contact.trim().slice(0, 200);
  if (!n && !c) return null;
  return db.referral.create({ data: { projectId, name: n, contact: c } });
}

/** Admin only, and never anywhere else. Criterion 25. */
export function referralsForAdmin(projectId: string) {
  return db.referral.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } });
}

export function allReferralsForAdmin() {
  return db.referral.findMany({ orderBy: { createdAt: "desc" }, include: { project: { include: { client: true } } } });
}

/**
 * The one deliberate exception to the no-delete rule. A referral holds a third
 * party's name and contact, and that person never consented to being stored,
 * so it can be removed on request (CLAUDE.md 5.1).
 */
export async function deleteReferral(id: string): Promise<void> {
  await db.referral.delete({ where: { id } });
}

/* -------------------------------------------------------------------------
 * The day-30 page itself (PORTAL-SPEC 6.5, criterion 10).
 * ---------------------------------------------------------------------- */

export function forProject(projectId: string) {
  return db.day30.findUnique({ where: { projectId } });
}

/**
 * Criterion 10: unlocking is a comparison made when the page is read, not a
 * job that runs. Nothing has to be scheduled, nothing can fail to fire, and a
 * process that was asleep for a month wakes up with the right answer.
 */
export function isUnlocked(day30: { unlocksAt: Date }, now: Date = new Date()): boolean {
  return day30.unlocksAt.getTime() <= now.getTime();
}

/** First view stamps the row, which is what the needs-attention block reads. */
export async function markOpened(projectId: string): Promise<void> {
  await db.day30.updateMany({
    where: { projectId, openedAt: null },
    data: { openedAt: new Date() },
  });
}

/**
 * The quote the client is editing, and nothing else about it.
 *
 * Criterion 26 says a draft testimonial never appears outside `/admin/`, and
 * this is the one place it does: CLAUDE.md 5.1 asks for the day-30 box to be
 * prefilled from what they wrote at delivery, so they edit rather than start
 * again. Showing someone their own words back, on their own authenticated
 * page, is not what that criterion is guarding against. Recorded in
 * QUESTIONS.md Q9. Returning the text alone, rather than the row, is what
 * keeps it from being anything more than that.
 */
export async function draftTextForClient(projectId: string): Promise<string> {
  const rows = await db.testimonial.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { text: true, moment: true },
  });
  const day30 = rows.find((r) => r.moment === TestimonialMoment.DAY30);
  return (day30 ?? rows.find((r) => r.moment === TestimonialMoment.DELIVERY))?.text ?? "";
}

export type Day30Result = { ok: true } | { ok: false; reason: "not_open" | "already_answered" };

/**
 * The whole page in one write: the number, and the quote with the two
 * permissions. Both are optional, as they are on the thank-you page: a client
 * who wants to give the number and not the quote should not be blocked, and
 * one who wants to give neither has still answered.
 *
 * The quote is approved here rather than left as a draft, because the client
 * approving it is exactly what this page is for.
 */
export async function submit(
  projectId: string,
  args: { metricAfter: string; quote: string; useName: boolean; useLogo: boolean },
): Promise<Day30Result> {
  const row = await db.day30.findUnique({ where: { projectId } });
  if (!row || !isUnlocked(row)) return { ok: false, reason: "not_open" };
  if (row.metricAfterSubmittedAt) return { ok: false, reason: "already_answered" };

  const metricAfter = args.metricAfter.trim().slice(0, 200);
  const quote = args.quote.trim().slice(0, 4000);

  const moved = await db.day30.updateMany({
    where: { projectId, metricAfterSubmittedAt: null },
    data: {
      metricAfterValue: metricAfter || null,
      metricAfterSubmittedAt: new Date(),
      openedAt: row.openedAt ?? new Date(),
    },
  });
  if (moved.count !== 1) return { ok: false, reason: "already_answered" };

  if (quote) {
    await db.testimonial.upsert({
      where: { projectId_moment: { projectId, moment: TestimonialMoment.DAY30 } },
      create: {
        projectId,
        moment: TestimonialMoment.DAY30,
        text: quote,
        useName: args.useName,
        useLogo: args.useLogo,
        status: TestimonialStatus.APPROVED,
        approvedAt: new Date(),
        approvedMethod: SignoffMethod.PORTAL,
      },
      update: {
        text: quote,
        useName: args.useName,
        useLogo: args.useLogo,
        status: TestimonialStatus.APPROVED,
        approvedAt: new Date(),
        approvedMethod: SignoffMethod.PORTAL,
      },
    });
  }

  await emit({
    type: "day30.approved",
    projectId,
    actor: "client",
    payload: { gaveNumber: Boolean(metricAfter), gaveQuote: Boolean(quote) },
  });
  return { ok: true };
}

/** ADMIN ONLY. What went wrong that the client did not say out loud. */
export async function setFrictionNotes(projectId: string, notes: string): Promise<void> {
  await db.day30.updateMany({ where: { projectId }, data: { frictionNotes: notes.trim().slice(0, 4000) } });
}
