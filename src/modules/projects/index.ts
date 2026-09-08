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
