"use server";

import { adminBase } from "@/lib/hosts";
import { inviteAdmin, requireAdmin } from "@/modules/auth/admin";

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
  return { link: `${adminBase()}/admin/setup/${result.token}`, email: result.email };
}
