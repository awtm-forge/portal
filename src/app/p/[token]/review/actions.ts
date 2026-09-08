"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CodePurpose, SignoffMethod } from "@/generated/prisma/enums";
import { clientIp } from "@/lib/rate-limit";
import { currentClientSession, projectByToken, requestCode, verifyCode } from "@/modules/auth/client";
import { requestChanges, signOffDelivery } from "@/modules/review";
import "@/modules/notifications/register";

export type ReviewState = {
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

/** PORTAL-SPEC 5.10: a fresh code even inside a valid session. */
export async function startSignOffAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const token = String(formData.get("token") ?? "");
  const project = await loadOrLeave(token);
  const result = await requestCode(project, CodePurpose.DELIVERY, await headers());
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

export async function confirmSignOffAction(prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const token = String(formData.get("token") ?? "");
  const code = String(formData.get("code") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const project = await loadOrLeave(token);
  const head = await headers();

  const verified = await verifyCode(project, CodePurpose.DELIVERY, code, head);
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

  const result = await signOffDelivery({
    projectId: project.id,
    actorName: name || project.signoffPersonName,
    method: SignoffMethod.PORTAL,
    ip: clientIp(head),
    userAgent: head.get("user-agent"),
  });
  if (!result.ok) {
    const why: Record<string, string> = {
      already_delivered: "This delivery is already signed off.",
      wrong_phase: "This project is not waiting to be checked just now.",
      no_round: "There is nothing waiting for you to check.",
      no_agreement: "There is no agreed agreement on this project.",
    };
    return { step: "idle", message: why[result.reason] ?? "It did not go through." };
  }
  // docs/SEQUENCES.md 3: once, straight after the sign-off.
  redirect(`/p/${token}/thanks`);
}

/** Saying what is off needs no code. It should never be harder than saying yes. */
export async function requestChangesAction(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const token = String(formData.get("token") ?? "");
  const text = String(formData.get("text") ?? "");
  const project = await loadOrLeave(token);
  const result = await requestChanges(project.id, text);
  if (!result.ok) {
    return {
      step: "idle",
      message: result.reason === "empty" ? "Say what is off and we will put it right." : "This is not open for changes just now.",
    };
  }
  return { step: "idle", noteSent: true };
}
