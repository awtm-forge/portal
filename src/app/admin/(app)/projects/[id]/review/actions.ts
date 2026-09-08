"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/modules/auth/admin";
import { deleteReferral } from "@/modules/day30";
import { emit } from "@/modules/events";
import { openRound } from "@/modules/review";
import { db } from "@/lib/db";
import "@/modules/notifications/register";

export type MarkReadyState = { message?: string; values?: Record<string, string> };

const schema = z.object({
  finishedWorkUrl: z.string().trim().min(1, "a link to the finished work").max(500),
});

/**
 * Marking ready. Rahul's rule of 8 Sep 2026: a review only happens when the
 * work is one hundred percent done, so there is always somewhere to see it and
 * the link is required.
 */
export async function markReadyAction(_prev: MarkReadyState, formData: FormData): Promise<MarkReadyState> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { message: `Needs ${parsed.error.issues[0].message}.`, values };
  if (!/^https?:\/\//i.test(parsed.data.finishedWorkUrl)) {
    return { message: "The link needs to start with https.", values };
  }

  const result = await openRound(projectId, parsed.data.finishedWorkUrl);
  if (!result.ok) {
    const why: Record<string, string> = {
      no_link: "A link to the finished work is needed.",
      no_agreement: "Nothing has been agreed on this project yet.",
      wrong_phase: "This project is not in the build, so there is nothing to mark ready.",
    };
    return { message: why[result.reason] ?? "It did not go through.", values };
  }
  redirect(`/admin/projects/${projectId}`);
}

/**
 * The one delete in the system. A referral holds a third party's name and
 * contact and that person never consented to being stored, so it can be
 * removed. The fact that it was removed stays, without the details.
 */
export async function forgetReferralAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("referralId") ?? "");
  const referral = await db.referral.findUnique({ where: { id } });
  if (!referral) redirect("/admin");
  await deleteReferral(id);
  await emit({ type: "referral.forgotten", projectId: referral.projectId, actor: admin.email, payload: {} });
  redirect(`/admin/projects/${referral.projectId}`);
}
