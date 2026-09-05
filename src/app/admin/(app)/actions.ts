"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminLogout, requireAdmin } from "@/lib/admin-auth";
import { rotateProjectToken } from "@/lib/client-auth";
import { hashToken, randomToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { slugify } from "@/lib/format";

export async function logoutAction(): Promise<void> {
  await adminLogout();
  redirect("/admin/login");
}

/** The client link is shown once, right after it is made. Only its hash is stored. */
const FLASH = "awtm_flash_link";
export async function setFlashLink(projectId: string, token: string): Promise<void> {
  (await cookies()).set(FLASH, `${projectId}:${token}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/admin", maxAge: 300,
  });
}
export async function takeFlashLink(projectId: string): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(FLASH)?.value;
  if (!raw) return null;
  const [id, token] = raw.split(":");
  if (id !== projectId || !token) return null;
  return token;
}
export async function clearFlashLink(): Promise<void> {
  (await cookies()).delete(FLASH);
}

const newProjectSchema = z.object({
  businessName: z.string().trim().min(1).max(120),
  contactName: z.string().trim().min(1).max(120),
  contactPhone: z.string().trim().min(8).max(24),
  contactEmail: z.string().trim().email().max(200),
  projectName: z.string().trim().min(1).max(120),
  slug: z.string().trim().max(60).optional(),
  typeOfWork: z.enum(["STORE", "APP", "SAAS", "MARKETING", "BRAND"]),
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
  const baseSlug = slugify(d.slug || `${d.businessName} ${d.projectName}`) || "project";
  let slug = baseSlug;
  for (let i = 2; await db.project.findUnique({ where: { slug } }); i++) slug = `${baseSlug}-${i}`;

  const token = randomToken();
  const project = await db.project.create({
    data: {
      name: d.projectName,
      slug,
      typeOfWork: d.typeOfWork,
      accessTokenHash: hashToken(token),
      client: {
        create: {
          businessName: d.businessName,
          contactName: d.contactName,
          contactPhone: d.contactPhone,
          contactEmail: d.contactEmail.toLowerCase(),
          signoffPersonName: d.signoffPersonName,
          signoffPersonEmail: d.signoffPersonEmail.toLowerCase(),
        },
      },
    },
  });
  await setFlashLink(project.id, token);
  redirect(`/admin/projects/${project.id}`);
}

export async function rotateLinkAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) redirect("/admin");
  const token = await rotateProjectToken(projectId);
  await setFlashLink(projectId, token);
  redirect(`/admin/projects/${projectId}`);
}

export async function signoffDecisionAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const project = await db.project.findUnique({ where: { id: projectId }, include: { client: true } });
  if (!project) redirect("/admin");
  const c = project.client;
  if (decision === "use" && c.proposedSignoffEmail) {
    await db.client.update({
      where: { id: c.id },
      data: {
        signoffPersonEmail: c.proposedSignoffEmail,
        signoffPersonName: c.proposedSignoffName ?? c.signoffPersonName,
        proposedSignoffEmail: null, proposedSignoffName: null, proposedAt: null,
      },
    });
  } else {
    await db.client.update({ where: { id: c.id }, data: { proposedSignoffEmail: null, proposedSignoffName: null, proposedAt: null } });
  }
  redirect(`/admin/projects/${projectId}`);
}

const contactSchema = z.object({
  contactName: z.string().trim().min(1).max(120),
  contactPhone: z.string().trim().min(8).max(24),
  contactEmail: z.string().trim().email().max(200),
  signoffPersonName: z.string().trim().min(1).max(120),
  signoffPersonEmail: z.string().trim().email().max(200),
});

export async function updateContactAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) redirect("/admin");
  const parsed = contactSchema.safeParse(Object.fromEntries(formData.entries()));
  if (parsed.success) {
    const d = parsed.data;
    await db.client.update({
      where: { id: project.clientId },
      data: { ...d, contactEmail: d.contactEmail.toLowerCase(), signoffPersonEmail: d.signoffPersonEmail.toLowerCase() },
    });
  }
  redirect(`/admin/projects/${projectId}`);
}
