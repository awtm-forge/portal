"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminLogin } from "@/lib/admin-auth";

export type LoginState = { message?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { message: "Email and password, both." };
  const result = await adminLogin(email, password, await headers());
  if (!result.ok) {
    return { message: result.reason === "rate_limited" ? "Too many attempts. Wait fifteen minutes." : "That did not match." };
  }
  redirect("/admin");
}
