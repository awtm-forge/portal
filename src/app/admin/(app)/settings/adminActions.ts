"use server";

import { adminUrl } from "@/lib/request-origin";
import { refreshWith } from "@/lib/admin-nav";
import { canManageTeam, inviteAdmin, removeAdminAccess, removeUnusedAdmin, requireAdmin } from "@/modules/auth/admin";

export type InviteState = { message?: string; link?: string; email?: string; values?: { email: string; name: string } };

/**
 * Makes or refreshes an admin account and hands back its one-time setup
 * link, shown once on the page. Only its hash is stored, so this is the only
 * moment the link exists in the clear, same as a client link. Only the owner
 * may, once an owner is named (ADR 0024).
 */
export async function inviteAdminAction(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const me = await requireAdmin();
  const values = { email: String(formData.get("email") ?? ""), name: String(formData.get("name") ?? "") };
  if (!canManageTeam(me)) return { message: "Only the owner adds admins or reissues their links.", values };
  const result = await inviteAdmin(values);
  if (!result.ok) return { message: "Check the email and the name.", values };
  return { link: await adminUrl(`/admin/setup/${result.token}`), email: result.email };
}

/** Clears a stale seat: an account that never set a password. Refuses an active one. */
export async function removeAdminAction(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  if (!canManageTeam(me)) await refreshWith("/admin/settings", "Only the owner removes a seat.");
  await removeUnusedAdmin(String(formData.get("email") ?? ""));
  await refreshWith("/admin/settings", "Seat freed.");
}

/** Takes an active admin's access away. The owner only, never their own, never the owner's. */
export async function removeAccessAction(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  if (!canManageTeam(me)) await refreshWith("/admin/settings", "Only the owner removes access.");
  const result = await removeAdminAccess(String(formData.get("email") ?? ""), me);
  if (!result.ok) {
    const why =
      result.reason === "self" ? "Not removed: you cannot remove your own access."
      : result.reason === "owner" ? "Not removed: the owner's access cannot be taken away here."
      : result.reason === "not_active" ? "Not removed: that seat has no access to take away. Remove the seat instead."
      : "Not removed: no such admin.";
    await refreshWith("/admin/settings", why);
  }
  await refreshWith("/admin/settings", "Access removed. They are signed out everywhere, and their seat can be reissued later.");
}
