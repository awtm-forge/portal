"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { processUpload, REASON_TEXT } from "@/lib/files";
import { parseDocumentLoose } from "@/lib/intake/document";
import { removeStored, writeLibraryFile } from "@/lib/storage";

export type LibraryState = { message?: string };

const KEY = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** Which library keys are named by any uploaded questionnaire. */
export async function libraryUsage(): Promise<Map<string, number>> {
  const intakes = await db.intake.findMany({ select: { document: true } });
  const usage = new Map<string, number>();
  for (const i of intakes) {
    const doc = parseDocumentLoose(i.document);
    const keys = new Set<string>();
    for (const s of doc?.sections ?? []) for (const q of s.questions) if (q.type === "image_choice") for (const o of q.options) keys.add(o.image);
    for (const k of keys) usage.set(k, (usage.get(k) ?? 0) + 1);
  }
  return usage;
}

export async function uploadImageAction(_prev: LibraryState, formData: FormData): Promise<LibraryState> {
  await requireAdmin();
  const key = String(formData.get("key") ?? "").trim().toLowerCase();
  const caption = String(formData.get("caption") ?? "").trim().slice(0, 120);
  const file = formData.get("file");
  if (!KEY.test(key)) return { message: "Key: lowercase letters, digits and hyphens, starting with a letter or digit." };
  if (!caption) return { message: "A caption is needed. It is shown under the picture." };
  if (!(file instanceof File) || file.size === 0) return { message: "Choose a file." };
  const r = await processUpload(Buffer.from(await file.arrayBuffer()));
  if (!r.ok) return { message: REASON_TEXT[r.reason] };
  if (r.file.kind === "pdf") return { message: "The library holds pictures, not PDFs." };
  const storedPath = await writeLibraryFile(r.file.ext, r.file.data);
  const existing = await db.imageLibrary.findUnique({ where: { key } });
  if (existing) {
    await db.imageLibrary.update({ where: { key }, data: { storedPath, mimeType: r.file.mime, caption, uploadedAt: new Date() } });
    await removeStored(existing.storedPath);
  } else {
    await db.imageLibrary.create({ data: { key, caption, storedPath, mimeType: r.file.mime } });
  }
  redirect("/admin/library");
}

export async function deleteImageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const key = String(formData.get("key") ?? "");
  const usage = await libraryUsage();
  if ((usage.get(key) ?? 0) > 0) redirect("/admin/library");
  const row = await db.imageLibrary.findUnique({ where: { key } });
  if (row) {
    await db.imageLibrary.delete({ where: { key } });
    await removeStored(row.storedPath);
  }
  redirect("/admin/library");
}
