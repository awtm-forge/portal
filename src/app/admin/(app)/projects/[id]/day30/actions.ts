"use server";

import { redirect } from "next/navigation";
import { SignoffMethod, TestimonialMoment } from "@/generated/prisma/enums";
import { requireAdmin } from "@/modules/auth/admin";
import { approveTestimonial, setFrictionNotes } from "@/modules/day30";
import { closeProject } from "@/modules/projects";
import "@/modules/notifications/register";

/** ADMIN ONLY, and there is no client view that could carry it. */
export async function saveFrictionNotesAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  await setFrictionNotes(projectId, String(formData.get("frictionNotes") ?? ""));
  redirect(`/admin/projects/${projectId}`);
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
  redirect(`/admin/projects/${projectId}`);
}

/** PORTAL-SPEC 5.2, the last move: delivered to closed, by hand. */
export async function closeProjectAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  await closeProject(projectId);
  redirect(`/admin/projects/${projectId}`);
}
