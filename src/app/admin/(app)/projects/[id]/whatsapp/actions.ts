"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { SignoffMethod } from "@/generated/prisma/enums";
import { fromIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { agree } from "@/modules/agreements";
import { requireAdmin } from "@/modules/auth/admin";
import "@/modules/notifications/register";

export type RecordState = { message?: string; values?: Record<string, string> };

/**
 * PORTAL-SPEC 5.11. A client who replies "ok done" on WhatsApp has agreed just
 * as much as one who tapped, so this writes the same fields and the same
 * sign-off event. What it does not do is pretend they tapped: method is
 * whatsapp and the pasted message is kept, forever, on an append-only row.
 */
const schema = z.object({
  actorName: z.string().trim().min(1, "who said it").max(120),
  occurredOn: z.string().trim().min(1, "the date they said it"),
  rawNote: z.string().trim().min(1, "the message they sent").max(8000),
});

export async function recordWhatsappAgreementAction(_prev: RecordState, formData: FormData): Promise<RecordState> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));

  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return { message: `Needs ${parsed.error.issues[0].message}.`, values };
  }
  const at = fromIsoDate(parsed.data.occurredOn);
  if (!at) return { message: "That date did not read.", values };
  if (at.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    return { message: "That date is in the future.", values };
  }

  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) redirect("/admin");
  if (at < project.createdAt) {
    return { message: "That is before the project existed. Check the date.", values };
  }

  const result = await agree({
    projectId,
    actorName: parsed.data.actorName,
    method: SignoffMethod.WHATSAPP,
    rawNote: parsed.data.rawNote,
    at,
  });
  if (!result.ok) {
    const why: Record<string, string> = {
      already_agreed: "This agreement is already signed off.",
      wrong_phase: "The agreement has to be sent before it can be agreed.",
      no_agreement: "There is no agreement on this project yet.",
    };
    return { message: why[result.reason] ?? "It did not go through.", values };
  }
  redirect(`/admin/projects/${projectId}`);
}
