/**
 * The weekly written update (PORTAL-SPEC 4, 6.1 and 7).
 *
 * A draft until it is sent. After that it has been read by a client, so this
 * module refuses to change it: an update that quietly changes after the fact
 * is worth less than one that does not exist.
 */
import type { UpdateModel } from "@/generated/prisma/models";
import { db } from "@/lib/db";
import { emit } from "@/modules/events";

export class UpdateSent extends Error {
  constructor() {
    super("That update has been sent. Write the next week rather than changing it.");
    this.name = "UpdateSent";
  }
}

export type UpdateDraft = {
  weekNumber: number;
  moved: string;
  nextUp: string;
  needFromYou: string;
  needByDate: Date | null;
  risks: string;
  stagingUrl: string | null;
};

/** The week this project is in, from the agreement's start date. */
export function weekNumberOn(startDate: Date | null, at: Date = new Date()): number {
  if (!startDate) return 1;
  const days = Math.floor((at.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, Math.floor(days / 7) + 1);
}

/**
 * The week to write next: one after the last one written, or, for the first
 * update, whichever week the calendar says the build is in. A project that
 * started three weeks ago opens on week 4, not week 1.
 */
export async function nextWeekNumber(projectId: string, startDate: Date | null): Promise<number> {
  const last = await db.update.findFirst({ where: { projectId }, orderBy: { weekNumber: "desc" } });
  return last ? last.weekNumber + 1 : weekNumberOn(startDate);
}

export async function saveDraft(projectId: string, draft: UpdateDraft): Promise<UpdateModel> {
  const existing = await db.update.findUnique({
    where: { projectId_weekNumber: { projectId, weekNumber: draft.weekNumber } },
  });
  if (existing?.sentAt) throw new UpdateSent();
  const data = {
    moved: draft.moved,
    nextUp: draft.nextUp,
    needFromYou: draft.needFromYou,
    needByDate: draft.needByDate,
    risks: draft.risks,
    stagingUrl: draft.stagingUrl,
  };
  if (!existing) return db.update.create({ data: { projectId, weekNumber: draft.weekNumber, ...data } });
  return db.update.update({ where: { id: existing.id }, data });
}

export type SendResult = { ok: true; update: UpdateModel } | { ok: false; reason: "not_found" | "already_sent" };

/** Sending is what makes it visible to the client, and what freezes it. */
export async function send(projectId: string, weekNumber: number): Promise<SendResult> {
  const existing = await db.update.findUnique({ where: { projectId_weekNumber: { projectId, weekNumber } } });
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.sentAt) return { ok: false, reason: "already_sent" };
  const update = await db.update.update({ where: { id: existing.id }, data: { sentAt: new Date() } });
  await emit({
    type: "update.sent",
    projectId,
    actor: "team",
    payload: { weekNumber, hasRisks: update.risks.trim().length > 0 },
  });
  return { ok: true, update };
}

export function forProject(projectId: string) {
  return db.update.findMany({ where: { projectId }, orderBy: { weekNumber: "desc" } });
}

/** Only what a client may read: everything, since an update has no private half. */
export function sentForProject(projectId: string) {
  return db.update.findMany({ where: { projectId, sentAt: { not: null } }, orderBy: { weekNumber: "desc" } });
}
