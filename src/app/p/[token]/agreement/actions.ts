"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CodePurpose } from "@/generated/prisma/enums";
import { SignoffMethod } from "@/generated/prisma/enums";
import { clientIp } from "@/lib/rate-limit";
import { addClientNote, agree } from "@/modules/agreements";
import { currentClientSession, projectByToken, requestCode, verifyCode } from "@/modules/auth/client";
import "@/modules/notifications/register";

export type AgreeState = {
  step: "idle" | "code";
  message?: string;
  sentTo?: string;
  locked?: boolean;
  noteSent?: boolean;
};

async function loadOrLeave(token: string) {
  const project = await projectByToken(token);
  if (!project) redirect("/p/not-found");
  if (!(await currentClientSession(project.id))) redirect(`/p/${token}`);
  return project;
}

/**
 * PORTAL-SPEC 5.10: a fresh code even inside a valid session. That is what
 * makes the sign-off attributable to a person at a moment.
 */
export async function startAgreeAction(_prev: AgreeState, formData: FormData): Promise<AgreeState> {
  const token = String(formData.get("token") ?? "");
  const project = await loadOrLeave(token);
  const result = await requestCode(project, CodePurpose.AGREEMENT, await headers());
  if (!result.ok) {
    return {
      step: "idle",
      message: result.reason === "rate_limited"
        ? "Too many codes asked for. Wait a few minutes and try again."
        : "The email did not go out. Message Rahul on WhatsApp and we will sort it.",
    };
  }
  return { step: "code", sentTo: result.sentTo };
}

export async function confirmAgreeAction(prev: AgreeState, formData: FormData): Promise<AgreeState> {
  const token = String(formData.get("token") ?? "");
  const code = String(formData.get("code") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const project = await loadOrLeave(token);
  const head = await headers();

  const verified = await verifyCode(project, CodePurpose.AGREEMENT, code, head);
  if (!verified.ok) {
    switch (verified.reason) {
      case "wrong":
        return { ...prev, step: "code", message: `Wrong code, ${verified.attemptsLeft} ${verified.attemptsLeft === 1 ? "try" : "tries"} left.` };
      case "expired":
      case "no_code":
        return { step: "idle", message: "That code has expired. Ask for a new one." };
      case "locked":
        return { ...prev, step: "code", locked: true, message: "Locked after five tries. Ask for a new code, or message Rahul." };
      case "rate_limited":
        return { ...prev, step: "code", message: "Too many attempts. Wait a few minutes." };
    }
  }

  const result = await agree({
    projectId: project.id,
    actorName: name || project.client.signoffPersonName,
    method: SignoffMethod.PORTAL,
    ip: clientIp(head),
    userAgent: head.get("user-agent"),
  });
  if (!result.ok) {
    const why: Record<string, string> = {
      already_agreed: "This agreement is already signed off.",
      wrong_phase: "This agreement is not waiting to be agreed.",
      no_agreement: "There is no agreement on this project yet.",
    };
    return { step: "idle", message: why[result.reason] ?? "It did not go through." };
  }
  redirect(`/p/${token}/agreement`);
}

/** CLAUDE.md 5.1: pushing back needs no code. */
export async function pushBackAction(_prev: AgreeState, formData: FormData): Promise<AgreeState> {
  const token = String(formData.get("token") ?? "");
  const text = String(formData.get("text") ?? "");
  const project = await loadOrLeave(token);
  const result = await addClientNote(project.id, text);
  if (!result.ok) {
    return {
      step: "idle",
      message: result.reason === "empty" ? "Say what is off and we will fix it." : "This agreement is not open for changes just now.",
    };
  }
  return { step: "idle", noteSent: true };
}
