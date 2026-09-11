"use server";

import { refreshTo, refreshWith } from "@/lib/admin-nav";
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
  await refreshWith(`/admin/projects/${projectId}`, "Notes saved.");
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
    await refreshWith(`/admin/projects/${projectId}`, "Approved, recorded as said on WhatsApp.");
  }
  refreshTo(`/admin/projects/${projectId}`);
}

/** PORTAL-SPEC 5.2, the last move: delivered to closed, by hand. */
export async function closeProjectAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  await closeProject(projectId);
  await refreshWith(`/admin/projects/${projectId}`, "Closed. The record stays readable.");
}

/**
 * CLAUDE.md 5. Behind a confirm dialog with a required reason: this is the one
 * move that ends a project without a delivery. A refusal comes back as a toast
 * rather than a form state, because the dialog has already closed by then.
 */
export async function cancelProjectAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const result = await cancelProject(projectId, String(formData.get("reason") ?? ""));
  if (!result.ok) {
    const why = {
      no_reason: "Not cancelled: say why. It is the only thing anyone will have to go on later.",
      wrong_phase: "Not cancelled: a delivered or closed project cannot be cancelled.",
      not_found: "That project is not there any more.",
      raced: "Not cancelled: the project moved while you were typing. Look at it again.",
    }[result.reason];
    await refreshWith(result.reason === "not_found" ? "/admin" : `/admin/projects/${projectId}`, why);
  }
  await refreshWith(`/admin/projects/${projectId}`, "Cancelled. The client page says it was closed, with the date.");
}
