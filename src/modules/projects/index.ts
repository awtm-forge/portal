/**
 * Project-level moves that are not owned by another module. Anything with its
 * own area (agreements, review, intake) lives there instead.
 */
import { Phase } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { emit } from "@/modules/events";
import { transition } from "@/modules/projects/phase";

export type KickoffResult = { ok: true } | { ok: false; reason: "not_found" | "wrong_phase" };

/** PORTAL-SPEC 5.2: agreed to building, when Rahul says the kickoff happened. */
export async function markKickoffDone(projectId: string): Promise<KickoffResult> {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return { ok: false, reason: "not_found" };
  if (project.phase !== Phase.AGREED) return { ok: false, reason: "wrong_phase" };

  await transition(db, project, "kickoff_done");
  await db.project.update({ where: { id: projectId }, data: { kickoffAt: new Date() } });
  await emit({ type: "project.kickoff", projectId, actor: "team", payload: { projectName: project.name } });
  return { ok: true };
}

export type CloseResult = { ok: true } | { ok: false; reason: "not_found" | "wrong_phase" | "raced" };

/**
 * PORTAL-SPEC 5.2: delivered to closed, by hand, after day 30. There is no
 * date check on it. Rahul closes a project when it is finished with, and a
 * client who never answered day 30 should not hold the record open for ever.
 *
 * Closing changes nothing a client can see except the wording: the record
 * stays readable at the same link, which does not expire.
 */
export async function closeProject(projectId: string): Promise<CloseResult> {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return { ok: false, reason: "not_found" };
  if (project.phase !== Phase.DELIVERED) return { ok: false, reason: "wrong_phase" };

  try {
    await transition(db, project, "closed");
  } catch {
    return { ok: false, reason: "raced" };
  }
  await emit({ type: "project.closed", projectId, actor: "team", payload: { projectName: project.name } });
  return { ok: true };
}

export type CancelResult = { ok: true } | { ok: false; reason: "not_found" | "wrong_phase" | "no_reason" | "raced" };

/**
 * CLAUDE.md 5: a project cancelled mid-build. Reachable from any phase except
 * delivered and closed, and the reason is required, because a cancelled
 * project with no reason is a mystery six months later.
 *
 * It creates no invoice and changes no issued one. Whatever was raised stays
 * raised: cancelling is not a refund, and pretending otherwise in the record
 * would be worse than a conversation.
 */
export async function cancelProject(projectId: string, reason: string): Promise<CancelResult> {
  const text = reason.trim().slice(0, 500);
  if (!text) return { ok: false, reason: "no_reason" };

  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return { ok: false, reason: "not_found" };
  if (project.phase === Phase.DELIVERED || project.phase === Phase.CLOSED || project.phase === Phase.CANCELLED) {
    return { ok: false, reason: "wrong_phase" };
  }

  try {
    await transition(db, project, "cancelled");
  } catch {
    return { ok: false, reason: "raced" };
  }
  await db.project.update({ where: { id: projectId }, data: { cancelledAt: new Date(), cancelReason: text } });
  await emit({
    type: "project.cancelled",
    projectId,
    actor: "team",
    payload: { projectName: project.name, from: project.phase },
  });
  return { ok: true };
}

/* -------------------------------------------------------------------------
 * Readers for the admin screens. Here rather than in the pages, so no route
 * file imports prisma (CLAUDE.md 11). Folded in during step 11, which is the
 * step BUILD-LOG assigned it to.
 * ---------------------------------------------------------------------- */

/** The projects list, newest first, with what the list actually shows. */
export function listForAdmin() {
  return db.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      client: true,
      intake: { select: { submittedAt: true, lastSavedAt: true, document: true, answers: true, sectionsDone: true } },
    },
  });
}

/** One project with everything the detail page renders around it. */
export function forAdmin(projectId: string) {
  return db.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      intake: { include: { documentUploadedBy: { select: { name: true } } } },
      agreement: true,
    },
  });
}

export function signoffsForAdmin(projectId: string) {
  return db.signoffEvent.findMany({ where: { projectId }, orderBy: { occurredAt: "asc" } });
}

export function agreementNoteCount(projectId: string) {
  return db.agreementNote.count({ where: { projectId } });
}

export function notesForAdmin(projectId: string) {
  return db.agreementNote.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
}

/** The project with its client, for the screens that need no more than that. */
export function withClient(projectId: string) {
  return db.project.findUnique({ where: { id: projectId }, include: { client: true } });
}

export function withClientAndAgreement(projectId: string) {
  return db.project.findUnique({ where: { id: projectId }, include: { client: true, agreement: true } });
}

/** The agreement editor, which needs the intake to know if the gate is open. */
export function forAgreementEditor(projectId: string) {
  return db.project.findUnique({
    where: { id: projectId },
    include: { client: true, agreement: true, intake: true },
  });
}

/** Bare, for the actions that only need the phase and the name. */
export function byId(projectId: string) {
  return db.project.findUnique({ where: { id: projectId } });
}
