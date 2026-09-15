"use server";

import { redirect } from "next/navigation";
import { clientFromSession, clientLogout } from "@/modules/auth/client";

/**
 * Signing out, from the menu on any client page (Ayush, 15 Sep).
 *
 * The client is resolved from the session cookie rather than taken from the
 * form, in the same way the notification actions do it, so a page cannot sign
 * anyone out but the person reading it.
 *
 * It lands on /p/login rather than back on their own link. A person signing
 * out on a shared machine does not want their link left in the address bar of
 * it, and logging in by email needs no link at all.
 */
export async function clientLogoutAction(): Promise<void> {
  const client = await clientFromSession();
  if (client) await clientLogout(client.id);
  redirect("/p/login");
}
