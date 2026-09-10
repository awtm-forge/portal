import { db } from "@/lib/db";
import { processUpload, REASON_TEXT } from "@/lib/files";
import { removeStored, writeLibraryFile } from "@/lib/storage";
import { parseDocumentLoose } from "@/modules/intake/document";

/**
 * The image library (INTAKE-SPEC section 9): pictures an image_choice
 * question names by key, uploaded once and reused. A few dozen, ever. This
 * is the only place that reads or writes the table; the admin pages and the
 * importer come here (docs/ARCHITECTURE.md, no route imports Prisma).
 */
export const KEY = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function listImages() {
  return db.imageLibrary.findMany({ orderBy: { key: "asc" } });
}

export function imageByKey(key: string) {
  return db.imageLibrary.findUnique({ where: { key } });
}

/** What the importer checks an image_choice option against. */
export async function libraryKeys(): Promise<Set<string>> {
  return new Set((await db.imageLibrary.findMany({ select: { key: true } })).map((r) => r.key));
}

/** Which library keys are named by any uploaded questionnaire, and by how many. */
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

export type SaveImageResult = { ok: true } | { ok: false; message: string };

/** Adds a picture under a key, or replaces the one already there. Same file rules as every upload (INTAKE-SPEC section 4). */
export async function saveImage(input: { key: string; caption: string; file: File | null }): Promise<SaveImageResult> {
  const key = input.key.trim().toLowerCase();
  const caption = input.caption.trim().slice(0, 120);
  if (!KEY.test(key)) return { ok: false, message: "Key: lowercase letters, digits and hyphens, starting with a letter or digit." };
  if (!caption) return { ok: false, message: "A caption is needed. It is shown under the picture." };
  if (!(input.file instanceof File) || input.file.size === 0) return { ok: false, message: "Choose a file." };
  const r = await processUpload(Buffer.from(await input.file.arrayBuffer()));
  if (!r.ok) return { ok: false, message: REASON_TEXT[r.reason] };
  if (r.file.kind === "pdf") return { ok: false, message: "The library holds pictures, not PDFs." };
  const storedPath = await writeLibraryFile(r.file.ext, r.file.data);
  const existing = await db.imageLibrary.findUnique({ where: { key } });
  if (existing) {
    await db.imageLibrary.update({ where: { key }, data: { storedPath, mimeType: r.file.mime, caption, uploadedAt: new Date() } });
    await removeStored(existing.storedPath);
  } else {
    await db.imageLibrary.create({ data: { key, caption, storedPath, mimeType: r.file.mime } });
  }
  return { ok: true };
}

/** Refuses while any questionnaire names the key: a picture in use is part of a document a client may be looking at. */
export async function deleteImage(key: string): Promise<{ ok: boolean; reason?: "in_use" | "missing" }> {
  const usage = await libraryUsage();
  if ((usage.get(key) ?? 0) > 0) return { ok: false, reason: "in_use" };
  const row = await db.imageLibrary.findUnique({ where: { key } });
  if (!row) return { ok: false, reason: "missing" };
  await db.imageLibrary.delete({ where: { key } });
  await removeStored(row.storedPath);
  return { ok: true };
}
