"use server";

import { redirect } from "next/navigation";
import { IntakeParty } from "@/generated/prisma/enums";
import { requireAdmin } from "@/modules/auth/admin";
import { withIntake } from "@/modules/clients";
import { submitIntake } from "@/modules/intake/answers";
import { declineChange, openForChanges } from "@/modules/intake/changes";
import "@/modules/notifications/register";

/**
 * ADR 0016, the team's three moves on a sent questionnaire: open it for a
 * change (answering the client's ask, or on our own), decline the ask with
 * the line they read, and lock it again ourselves as the next version.
 */
export async function openChangesAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const requestId = String(formData.get("requestId") ?? "") || null;
  const note = String(formData.get("note") ?? "");
  await openForChanges(clientId, admin.id, requestId, note);
  redirect(`/admin/clients/${clientId}`);
}

export async function declineChangeAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const requestId = String(formData.get("requestId") ?? "");
  const reply = String(formData.get("reply") ?? "");
  await declineChange(clientId, admin.id, requestId, reply);
  redirect(`/admin/clients/${clientId}`);
}

export async function lockAgainAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const client = await withIntake(clientId);
  if (client?.intake) await submitIntake(client.intake.id, IntakeParty.TEAM);
  redirect(`/admin/clients/${clientId}`);
}
