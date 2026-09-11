"use server";

import { refreshTo } from "@/lib/admin-nav";
import { SignoffMethod, TestimonialMoment } from "@/generated/prisma/enums";
import { requireAdmin } from "@/modules/auth/admin";
import { approveTestimonial, setFrictionNotes } from "@/modules/day30";
import { cancelProject, closeProject } from "@/modules/projects";
import "@/modules/notifications/register";

/** ADMIN ONLY, and there is no client view that could carry it. */
export async function saveFrictionNotesAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  await setFrictionNotes(projectId, String(formData.get("frictionNotes") ?? ""));
  refreshTo(`/admin/projects/${projectId}`);
}

/**
 * CLAUDE.md 5.1: a quote is a draft until the client approves it at day 30,
 * or until we record that they said yes on WhatsApp. The method is kept for
 * the same reason a sign-off's is: the two never become indistinguishable.
 */
export async function approveTestimonialAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const moment = String(formData.get("moment") ?? "");
  if (moment === TestimonialMoment.DELIVERY || moment === TestimonialMoment.DAY30) {
    await approveTestimonial(projectId, moment, SignoffMethod.WHATSAPP);
  }
  refreshTo(`/admin/projects/${projectId}`);
}

/** PORTAL-SPEC 5.2, the last move: delivered to closed, by hand. */
export async function closeProjectAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  await closeProject(projectId);
  refreshTo(`/admin/projects/${projectId}`);
}

export type CancelState = { message?: string };

/**
 * CLAUDE.md 5. Kept behind its own confirmation in the UI, and the reason is
 * required: this is the one move that ends a project without a delivery.
 */
export async function cancelProjectAction(_prev: CancelState, formData: FormData): Promise<CancelState> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const result = await cancelProject(projectId, String(formData.get("reason") ?? ""));
  if (!result.ok) {
    return {
      message: {
        no_reason: "Say why. It is the only thing anyone will have to go on later.",
        wrong_phase: "A delivered or closed project cannot be cancelled.",
        not_found: "That project is not there any more.",
        raced: "The project moved while you were typing. Look at it again.",
      }[result.reason],
    };
  }
  refreshTo(`/admin/projects/${projectId}`);
}
