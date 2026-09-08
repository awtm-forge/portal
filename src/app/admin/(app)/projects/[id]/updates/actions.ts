"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { Phase } from "@/generated/prisma/enums";
import { fromIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/admin";
import { emit } from "@/modules/events";
import { next } from "@/modules/projects/phase";
import { saveDraft, send, UpdateSent } from "@/modules/updates";
import "@/modules/notifications/register";

export type UpdateState = { message?: string; ok?: string; values?: Record<string, string> };

const schema = z.object({
  weekNumber: z.coerce.number().int().min(1).max(200),
  moved: z.string().trim().min(1, "what moved").max(4000),
  nextUp: z.string().trim().min(1, "what is next").max(4000),
  needFromYou: z.string().trim().max(4000).default(""),
  needByDate: z.string().trim().max(20).default(""),
  risks: z.string().trim().max(4000).default(""),
  stagingUrl: z.string().trim().max(300).default(""),
});

export async function saveUpdateAction(_prev: UpdateState, formData: FormData): Promise<UpdateState> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return { message: `Needs ${parsed.error.issues[0].message}.`, values };
  }
  const d = parsed.data;
  if (d.stagingUrl && !/^https?:\/\//i.test(d.stagingUrl)) {
    return { message: "The staging link needs to start with https.", values };
  }

  try {
    await saveDraft(projectId, {
      weekNumber: d.weekNumber,
      moved: d.moved,
      nextUp: d.nextUp,
      needFromYou: d.needFromYou,
      needByDate: d.needByDate ? fromIsoDate(d.needByDate) : null,
      risks: d.risks,
      stagingUrl: d.stagingUrl || null,
    });
  } catch (error) {
    if (error instanceof UpdateSent) return { message: error.message, values };
    throw error;
  }

  if (String(formData.get("intent")) === "send") {
    const result = await send(projectId, d.weekNumber);
    if (!result.ok) {
      return { message: result.reason === "already_sent" ? "That week was already sent." : "Nothing to send.", values };
    }
    redirect(`/admin/projects/${projectId}`);
  }
  return { ok: "Saved as a draft. The client cannot see it yet.", values };
}

/** PORTAL-SPEC 5.2: agreed to building, when Rahul says the kickoff happened. */
export async function markKickoffAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) redirect("/admin");
  if (project.phase === Phase.AGREED) {
    await db.project.update({
      where: { id: projectId },
      data: { phase: next(project.phase, "kickoff_done").to },
    });
    await emit({ type: "project.kickoff", projectId, actor: "team", payload: { projectName: project.name } });
  }
  redirect(`/admin/projects/${projectId}`);
}
