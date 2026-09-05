"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { projectByToken, requestLoginCode, verifyLoginCode } from "@/lib/client-auth";

export type CodeState = { step: "start" | "enter"; message?: string; sentTo?: string; locked?: boolean };

export async function sendCodeAction(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const token = String(formData.get("token") ?? "");
  const project = await projectByToken(token);
  if (!project) redirect("/p/not-found");
  const result = await requestLoginCode(project, await headers());
  if (!result.ok) {
    return {
      step: "start",
      message: result.reason === "rate_limited"
        ? "Too many codes asked for. Wait a few minutes and try again."
        : "The email did not go out. Message Rahul on WhatsApp and we will sort it.",
    };
  }
  return { step: "enter", sentTo: result.sentTo };
}

export async function verifyCodeAction(prev: CodeState, formData: FormData): Promise<CodeState> {
  const token = String(formData.get("token") ?? "");
  const code = String(formData.get("code") ?? "");
  const project = await projectByToken(token);
  if (!project) redirect("/p/not-found");
  const result = await verifyLoginCode(project, code, await headers());
  if (result.ok) redirect(`/p/${token}`);
  const sentTo = prev.sentTo;
  switch (result.reason) {
    case "wrong":
      return { step: "enter", sentTo, message: `Wrong code, ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "try" : "tries"} left.` };
    case "expired":
    case "no_code":
      return { step: "start", message: "That code has expired. Ask for a new one." };
    case "locked":
      return { step: "enter", sentTo, locked: true, message: "Locked after five tries. Ask for a new code, or message Rahul." };
    case "rate_limited":
      return { step: "enter", sentTo, message: "Too many attempts. Wait a few minutes." };
  }
}
