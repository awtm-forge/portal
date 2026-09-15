"use server";

import { cookies } from "next/headers";
import { refreshTo, refreshWith } from "@/lib/admin-nav";
import { z } from "zod";
import { COUNTRY_CODE_MESSAGE, hasCountryCode } from "@/lib/phone";
import { fromIsoDate, isTodayOrLater, weekdayDayMonth } from "@/lib/dates";
import { db } from "@/lib/db";
import { adminLogout, reauthenticateAdmin, requireAdmin } from "@/modules/auth/admin";
import { keepClientToken } from "@/modules/auth/client";
import { createClient, deliverLink, rotateLink } from "@/modules/clients";
import { removeClient } from "@/modules/clients/remove";
import { createProject } from "@/modules/projects";
import "@/modules/notifications/register";

export async function logoutAction(): Promise<void> {
  await adminLogout();
  refreshTo("/admin/login");
}

/**
 * The client link is shown once, right after it is made, because only its
 * hash is stored. It rides a short-lived cookie from the action that made it
 * to the screen that shows it.
 */
const FLASH = "awtm_flash_link";

export async function setFlashLink(clientId: string, token: string): Promise<void> {
  (await cookies()).set(FLASH, `${clientId}:${token}`, {
    httpOnly: true,
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    sameSite: "lax",
    path: "/admin",
    maxAge: 900,
  });
}

export async function takeFlashLink(clientId: string): Promise<string | null> {
  const raw = (await cookies()).get(FLASH)?.value;
  if (!raw) return null;
  const [id, token] = raw.split(":");
  if (id !== clientId || !token) return null;
  return token;
}

export async function clearFlashLink(): Promise<void> {
  (await cookies()).delete(FLASH);
}

const TYPES = ["STORE", "APP", "SAAS", "MARKETING", "BRAND"] as const;

/* -------------------------------------------------------------------------
 * Clients. A client is its own record, made on the discovery call before
 * anyone knows what the project is, and the link is theirs from that moment
 * (ADR 0015). Nothing else happens when one is saved: no project, no email.
 * ---------------------------------------------------------------------- */

const clientSchema = z.object({
  businessName: z.string().trim().min(1).max(120),
  location: z.string().trim().max(120).optional().default(""),
  contactName: z.string().trim().min(1).max(120),
  // Every "Tell them on WhatsApp" on the admin side is built from this, so it
  // needs the country code for the same reason the company's own does.
  contactPhone: z.string().trim().min(8).max(24).refine(hasCountryCode, COUNTRY_CODE_MESSAGE),
  contactEmail: z.string().trim().email().max(200),
});

export type ClientFormState = { message?: string; values?: Record<string, string> };

export async function createClientAction(_prev: ClientFormState, formData: FormData): Promise<ClientFormState> {
  await requireAdmin();
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = clientSchema.safeParse(values);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { message: `${first.path.join(".")}: ${first.message}`, values };
  }
  const d = parsed.data;
  const { id, token } = await createClient({
    businessName: d.businessName,
    location: d.location || null,
    contactName: d.contactName,
    contactPhone: d.contactPhone,
    contactEmail: d.contactEmail,
  });
  await setFlashLink(id, token);
  refreshTo(`/admin/clients/${id}/link`);
}

export async function updateClientAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const parsed = clientSchema.safeParse(Object.fromEntries(formData.entries()));
  if (parsed.success) {
    const d = parsed.data;
    await db.client.update({
      where: { id: clientId },
      data: {
        businessName: d.businessName,
        location: d.location || null,
        contactName: d.contactName,
        contactPhone: d.contactPhone,
        contactEmail: d.contactEmail.toLowerCase(),
      },
    });
    await refreshWith(`/admin/clients/${clientId}`, "Client details saved.");
  }
  await refreshWith(`/admin/clients/${clientId}`, "Not saved: check the details. Every field but the place is needed, and the email must be one.");
}

/**
 * Sends the link by email. Only a token this session still holds can be
 * sent, because only its hash is stored: otherwise the link is rotated first,
 * which is the honest way to get a new one.
 */
export async function resendLinkAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const token = (await takeFlashLink(clientId)) ?? (await freshToken(clientId));
  await deliverLink(clientId, token);
  await refreshWith(`/admin/clients/${clientId}/link`, "Sending the link by email.");
}

async function freshToken(clientId: string): Promise<string> {
  const token = await rotateLink(clientId);
  await setFlashLink(clientId, token);
  return token;
}

/**
 * A link minted before ADR 0021 has no copy this page can show. The team has
 * it in sent mail or a WhatsApp thread; pasted here, it is checked against the
 * hash and kept, so the page can show it from then on (Ayush, 15 Sep).
 */
export async function keepLinkAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  if (!(await db.client.findUnique({ where: { id: clientId } }))) refreshTo("/admin/clients");
  const result = await keepClientToken(clientId, String(formData.get("link") ?? "").slice(0, 600));
  await refreshWith(
    `/admin/clients/${clientId}/link`,
    result === "kept" ? "Kept. This page can show their link from now on." : "Not kept: that is not their link. Check the address and try again.",
  );
}

/**
 * Removing a client for good (ADR 0022). Three things have to be true before
 * anything happens: the name typed matches theirs, there is a reason, and the
 * password is the signed-in admin's own. The password is checked last, so a
 * typo in the name does not spend one of its five tries.
 */
export async function removeClientAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const client = await db.client.findUnique({ where: { id: clientId }, select: { businessName: true } });
  if (!client) refreshTo("/admin/clients");
  const back = `/admin/clients/${clientId}`;
  const typed = String(formData.get("confirmName") ?? "").trim().toLowerCase();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  const password = String(formData.get("password") ?? "");
  if (typed !== client!.businessName.trim().toLowerCase()) await refreshWith(back, "Not removed: the name you typed does not match theirs.");
  if (!reason) await refreshWith(back, "Not removed: say why, in a line. It is the one thing that survives.");
  const auth = await reauthenticateAdmin(admin.id, password);
  if (auth === "rate_limited") await refreshWith(back, "Not removed: too many wrong passwords. Wait fifteen minutes.");
  if (auth !== "ok") await refreshWith(back, "Not removed: that is not your password.");
  const result = await removeClient(clientId, { adminId: admin.id, adminName: admin.name }, reason);
  if (!result.ok && result.reason === "blocked") {
    await refreshWith(back, "Not removed: something has been signed, invoiced or reviewed for them. Cancel or close the project instead.");
  }
  if (!result.ok) refreshTo("/admin/clients");
  await refreshWith("/admin/clients", `Removed ${client!.businessName}. Nothing of theirs is left but a line in the log.`);
}

export async function rotateLinkAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  if (!(await db.client.findUnique({ where: { id: clientId } }))) refreshTo("/admin/clients");
  const token = await freshToken(clientId);
  await deliverLink(clientId, token);
  await refreshWith(`/admin/clients/${clientId}/link`, "New link made. The old one has stopped working.");
}

/* -------------------------------------------------------------------------
 * Projects. Starting one puts it on the client's existing link.
 * ---------------------------------------------------------------------- */

const newProjectSchema = z.object({
  clientId: z.string().trim().min(1),
  projectName: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(60).optional(),
  typeOfWork: z.enum(TYPES),
  signoffPersonName: z.string().trim().min(1).max(120),
  signoffPersonEmail: z.string().trim().email().max(200),
});

export type NewProjectState = { message?: string; values?: Record<string, string> };

export async function createProjectAction(_prev: NewProjectState, formData: FormData): Promise<NewProjectState> {
  await requireAdmin();
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = newProjectSchema.safeParse(values);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { message: `${first.path.join(".")}: ${first.message}`, values };
  }
  const d = parsed.data;
  const result = await createProject({
    clientId: d.clientId,
    name: d.projectName,
    slug: d.slug,
    typeOfWork: d.typeOfWork,
    signoffPersonName: d.signoffPersonName,
    signoffPersonEmail: d.signoffPersonEmail,
  });
  if ("error" in result) return { message: "That client no longer exists.", values };

  // The client already has their link. If it never went out, this is the
  // moment: the page now has something on it.
  const client = await db.client.findUnique({ where: { id: d.clientId } });
  if (client && !client.linkEmailedAt) {
    const token = (await takeFlashLink(client.id)) ?? (await freshToken(client.id));
    await deliverLink(client.id, token);
  }
  refreshTo(`/admin/projects/${result.id}`);
}

/**
 * INTAKE-SPEC: the client can propose a different approver on the
 * questionnaire. Held on the client until a project exists, and offered when
 * one is started; this is admin taking or declining it by hand.
 */
export async function signoffDecisionAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) refreshTo("/admin/clients");

  if (decision === "use" && client.proposedSignoffEmail && projectId) {
    await db.project.update({
      where: { id: projectId },
      data: { signoffPersonEmail: client.proposedSignoffEmail, signoffPersonName: client.proposedSignoffName ?? undefined },
    });
  }
  await db.client.update({
    where: { id: clientId },
    data: { proposedSignoffEmail: null, proposedSignoffName: null, proposedAt: null },
  });
  await refreshWith(projectId ? `/admin/projects/${projectId}` : `/admin/clients/${clientId}`, decision === "use" ? "Switched to the sign-off they named." : "Kept the sign-off as it was.");
}

const signoffSchema = z.object({
  signoffPersonName: z.string().trim().min(1).max(120),
  signoffPersonEmail: z.string().trim().email().max(200),
});

/**
 * The date the client sees on their own page, set by hand and by us (13 Sep).
 *
 * A date in the past is refused rather than saved: the client page would read
 * it as a promise already broken, and the cure is a new date, not a stale one.
 * Every phase move clears it (transition), so it always belongs to the stage
 * the project is in now. Empty clears it, which is how you take a date back.
 */
export async function setExpectedByAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const path = `/admin/projects/${projectId}`;
  const raw = String(formData.get("expectedBy") ?? "").trim();

  if (raw === "") {
    await db.project.update({ where: { id: projectId }, data: { expectedBy: null } });
    await refreshWith(path, "The date is off their page. It now says we will message them.");
  }
  const when = fromIsoDate(raw);
  if (!when) await refreshWith(path, "Not saved: that is not a date.");
  if (!isTodayOrLater(when!)) await refreshWith(path, "Not saved: that date has passed. Give them a date you can still meet.");
  await db.project.update({ where: { id: projectId }, data: { expectedBy: when } });
  await refreshWith(path, `Their page now says to expect it by ${weekdayDayMonth(when)}.`);
}

export async function updateSignoffAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const parsed = signoffSchema.safeParse(Object.fromEntries(formData.entries()));
  if (parsed.success) {
    await db.project.update({
      where: { id: projectId },
      data: { signoffPersonName: parsed.data.signoffPersonName, signoffPersonEmail: parsed.data.signoffPersonEmail.toLowerCase() },
    });
    await refreshWith(`/admin/projects/${projectId}`, "Sign-off person saved. Codes go to the new address from now.");
  }
  await refreshWith(`/admin/projects/${projectId}`, "Not saved: a name and a real email are needed.");
}
