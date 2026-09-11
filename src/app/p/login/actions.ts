"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CodePurpose } from "@/generated/prisma/enums";
import { clientByEmail, maskEmail, requestCode, verifyCode } from "@/modules/auth/client";
import { allow, clientIp } from "@/lib/rate-limit";

/**
 * Logging in without the link (Q18): the client gives the email they gave us,
 * a one-time code goes to it, and on success the session lands them on their
 * page at /p/me. The link stays the primary way in; this is the way back when
 * it is lost or a character went missing from it.
 */
export type LoginState = { step: "start" | "enter"; email?: string; sentTo?: string; message?: string; locked?: boolean };

export async function sendLoginCodeAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const head = await headers();
  if (!(await allow(`login-req:ip:${clientIp(head)}`, 10, 60 * 60))) {
    return { step: "start", email, message: "Too many tries just now. Wait a few minutes and try again." };
  }
  if (!email.includes("@")) return { step: "start", email, message: "Enter the email you gave us." };
  const client = await clientByEmail(email);
  if (client) {
    const r = await requestCode({ client }, CodePurpose.LOGIN, head);
    if (!r.ok && r.reason === "send_failed") {
      return { step: "start", email, message: "The email did not go out. Message Rahul on WhatsApp and we will sort it." };
    }
  }
  // The same next step whether or not the email is on file, so a guess at an
  // address learns nothing about who is a client.
  return { step: "enter", email, sentTo: maskEmail(email) };
}

export async function verifyLoginCodeAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? prev.email ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "");
  const head = await headers();
  const client = await clientByEmail(email);
  if (!client) return { step: "enter", email, sentTo: prev.sentTo, message: "That code has expired. Ask for a new one." };
  const result = await verifyCode({ client }, CodePurpose.LOGIN, code, head);
  if (result.ok) redirect("/p/me");
  switch (result.reason) {
    case "wrong":
      return { step: "enter", email, sentTo: prev.sentTo, message: `Wrong code, ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "try" : "tries"} left.` };
    case "expired":
    case "no_code":
      return { step: "start", email, message: "That code has expired. Ask for a new one." };
    case "locked":
      return { step: "enter", email, sentTo: prev.sentTo, locked: true, message: "Locked after five tries. Ask for a new code, or message Rahul." };
    case "rate_limited":
      return { step: "enter", email, sentTo: prev.sentTo, message: "Too many attempts. Wait a few minutes." };
  }
}
