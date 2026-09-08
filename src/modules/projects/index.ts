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
