"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashToken, randomToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { slugify } from "@/lib/format";
import { requestLogger } from "@/lib/logger";
import { adminLogout, requireAdmin } from "@/modules/auth/admin";
import { projectLink, rotateProjectToken } from "@/modules/auth/client";
import { emit } from "@/modules/events";
import { sendLinkEmail } from "@/modules/notifications";
import "@/modules/notifications/register";

export async function logoutAction(): Promise<void> {
  await adminLogout();
  redirect("/admin/login");
}

/**
 * The client link is shown once, right after it is made, because only its hash
 * is stored. It rides a short-lived cookie from the action that made it to the
 * screen that shows it.
 */
const FLASH = "awtm_flash_link";

export async function setFlashLink(projectId: string, token: string): Promise<void> {
  (await cookies()).set(FLASH, `${projectId}:${token}`, {
    httpOnly: true,
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    sameSite: "lax",
    path: "/admin",
    maxAge: 900,
  });
}

export async function takeFlashLink(projectId: string): Promise<string | null> {
  const raw = (await cookies()).get(FLASH)?.value;
  if (!raw) return null;
  const [id, token] = raw.split(":");
  if (id !== projectId || !token) return null;
  return token;
}

export async function clearFlashLink(): Promise<void> {
  (await cookies()).delete(FLASH);
}

const TYPES = ["STORE", "APP", "SAAS", "MARKETING", "BRAND"] as const;

/* -------------------------------------------------------------------------
 * Clients. A client is its own record, so it can be added on the discovery
 * call before anyone knows what the project is.
 * ---------------------------------------------------------------------- */

const clientSchema = z.object({
  businessName: z.string().trim().min(1).max(120),
  location: z.string().trim().max(120).optional().default(""),
  contactName: z.string().trim().min(1).max(120),
  contactPhone: z.string().trim().min(8).max(24),
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
  const client = await db.client.create({
    data: {
      businessName: d.businessName,
      location: d.location || null,
      contactName: d.contactName,
      contactPhone: d.contactPhone,
      contactEmail: d.contactEmail.toLowerCase(),
    },
  });
  if (String(formData.get("intent")) === "start_project") {
    redirect(`/admin/clients/${client.id}/projects/new`);
  }
  redirect(`/admin/clients/${client.id}`);
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
  }
  redirect(`/admin/clients/${clientId}`);
}

/* -------------------------------------------------------------------------
 * Projects. Creating one mints the link and emails it; the next screen is the
 * only place that link can ever be shown.
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
  const client = await db.client.findUnique({ where: { id: d.clientId } });
  if (!client) return { message: "That client no longer exists.", values };

  const baseSlug = slugify(d.slug || `${client.businessName} ${d.projectName}`) || "project";
  let slug = baseSlug;
  for (let i = 2; await db.project.findUnique({ where: { slug } }); i++) slug = `${baseSlug}-${i}`;

  const token = randomToken();
  const project = await db.project.create({
    data: {
      clientId: client.id,
      name: d.projectName,
      slug,
      typeOfWork: d.typeOfWork,
      signoffPersonName: d.signoffPersonName,
      signoffPersonEmail: d.signoffPersonEmail.toLowerCase(),
      accessTokenHash: hashToken(token),
    },
  });

  await setFlashLink(project.id, token);
  await emit({
    type: "project.created",
    projectId: project.id,
    actor: "team",
    payload: { projectName: project.name, businessName: client.businessName },
  });
  // CLAUDE.md 5.1: one link email on creation. A failure does not block
  // creation; the handover screen says so and offers a retry.
  await deliverLink(project.id, token);
  redirect(`/admin/projects/${project.id}/link`);
}

/** Sends the project link to the sign-off person and records the outcome. */
async function deliverLink(projectId: string, token: string): Promise<void> {
  const project = await db.project.findUnique({ where: { id: projectId }, include: { client: true } });
  if (!project) return;
  try {
    await sendLinkEmail({
      to: project.signoffPersonEmail,
      contactName: project.client.contactName,
      businessName: project.client.businessName,
      projectName: project.name,
      link: projectLink(token),
    });
    await db.project.update({ where: { id: projectId }, data: { linkEmailedAt: new Date(), linkEmailError: null } });
    await emit({ type: "project.link_emailed", projectId, actor: "system", payload: {} });
  } catch (error) {
    await requestLogger.error("link email failed", { projectId, error: String(error) });
    await db.project.update({ where: { id: projectId }, data: { linkEmailError: String(error).slice(0, 300) } });
  }
}

/**
 * Retry after a failed link email. Only a token this session still holds can
 * be sent, because only its hash is stored: otherwise the link is rotated,
 * which is the honest way to get a new one.
 */
export async function resendLinkAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const token = (await takeFlashLink(projectId)) ?? (await freshToken(projectId));
  await deliverLink(projectId, token);
  redirect(`/admin/projects/${projectId}/link`);
}

async function freshToken(projectId: string): Promise<string> {
  const token = await rotateProjectToken(projectId);
  await setFlashLink(projectId, token);
  return token;
}

export async function rotateLinkAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  if (!(await db.project.findUnique({ where: { id: projectId } }))) redirect("/admin");
  const token = await freshToken(projectId);
  await deliverLink(projectId, token);
  redirect(`/admin/projects/${projectId}/link`);
}

/** INTAKE-SPEC: the client can propose a different approver; admin decides. */
export async function signoffDecisionAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) redirect("/admin");

  if (decision === "use" && project.proposedSignoffEmail) {
    await db.project.update({
      where: { id: projectId },
      data: {
        signoffPersonEmail: project.proposedSignoffEmail,
        signoffPersonName: project.proposedSignoffName ?? project.signoffPersonName,
        proposedSignoffEmail: null,
        proposedSignoffName: null,
        proposedAt: null,
      },
    });
  } else {
    await db.project.update({
      where: { id: projectId },
      data: { proposedSignoffEmail: null, proposedSignoffName: null, proposedAt: null },
    });
  }
  redirect(`/admin/projects/${projectId}`);
}

const signoffSchema = z.object({
  signoffPersonName: z.string().trim().min(1).max(120),
  signoffPersonEmail: z.string().trim().email().max(200),
});

export async function updateSignoffAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const parsed = signoffSchema.safeParse(Object.fromEntries(formData.entries()));
  if (parsed.success) {
    await db.project.update({
      where: { id: projectId },
      data: {
        signoffPersonName: parsed.data.signoffPersonName,
        signoffPersonEmail: parsed.data.signoffPersonEmail.toLowerCase(),
      },
    });
  }
  redirect(`/admin/projects/${projectId}`);
}
