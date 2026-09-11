"use server";

import { adminUrl } from "@/lib/request-origin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { inviteAdmin, removeUnusedAdmin, requireAdmin } from "@/modules/auth/admin";

export type InviteState = { message?: string; link?: string; email?: string; values?: { email: string; name: string } };

/**
 * Makes or refreshes the other admin account and hands back its one-time
 * setup link, shown once on the page. Only its hash is stored, so this is
 * the only moment the link exists in the clear, same as a client link.
 */
export async function inviteAdminAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await requireAdmin();
  const values = { email: String(formData.get("email") ?? ""), name: String(formData.get("name") ?? "") };
  const result = await inviteAdmin(values);
  if (!result.ok) {
    return {
      message: result.reason === "limit" ? "Two accounts is the limit. Refresh one of the existing ones instead." : "Check the email and the name.",
      values,
    };
  }
  return { link: await adminUrl(`/admin/setup/${result.token}`), email: result.email };
}

/** Clears a stale seat: an account that never set a password. Refuses an active one. */
export async function removeAdminAction(formData: FormData): Promise<void> {
  await requireAdmin();
  await removeUnusedAdmin(String(formData.get("email") ?? ""));
  // Bust the router cache so the redirect shows the row actually gone: without
  // this the delete lands in the database but the same-path redirect re-serves
  // the stale render, which reads as a dead button (10 Sep 2026).
  revalidatePath("/admin/settings");
  redirect("/admin/settings");
}

