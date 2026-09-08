/**
 * Day 30, and the things the client gives back: the testimonial and the
 * referral (docs/ARCHITECTURE.md folder layout, CLAUDE.md 5.1).
 *
 * Step 8 uses `open`, called inside the delivery transaction, and the two
 * write functions the thank-you page needs. Step 10 fills in the unlock, the
 * metric and testimonial approval.
 */
import { SignoffMethod, TestimonialMoment, TestimonialStatus } from "@/generated/prisma/enums";
import type { Day30Model, ReferralModel, TestimonialModel } from "@/generated/prisma/models";
import { addDays } from "@/lib/dates";
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
