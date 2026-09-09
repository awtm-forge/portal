"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createFirstAdmin, type FirstRunResult } from "@/modules/auth/admin";

export type FirstRunState = { message?: string; values?: { email: string; name: string } };

const WHY: Record<Exclude<FirstRunResult, { ok: true }>["reason"], string> = {
  not_first_run: "Someone has already set this up. Sign in instead.",
  no_key_configured: "No SETUP_KEY is set on the server, so there is nothing to check you against.",
  bad_key: "That key does not match the one set on the server.",
  rate_limited: "Too many attempts. Wait an hour, or restart the app to clear it.",
  invalid: "Check the email and the name.",
};

export async function firstRunAction(_prev: FirstRunState, formData: FormData): Promise<FirstRunState> {
  const email = String(formData.get("email") ?? "");
  const name = String(formData.get("name") ?? "");
  const result = await createFirstAdmin({
    email,
    name,
    key: String(formData.get("key") ?? ""),
    headers: await headers(),
  });
  if (!result.ok) return { message: WHY[result.reason], values: { email, name } };

  // Straight to the screen that sets passwords, so there is still only one.
  redirect(`/admin/setup/${result.token}`);
}
