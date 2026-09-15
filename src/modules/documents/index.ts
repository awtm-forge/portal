import { IntakeParty } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { MAX_FILE_BYTES, processUpload, REASON_TEXT, svgThumb } from "@/lib/files";
import { readStored, removeStored, writeClientFile } from "@/lib/storage";
import { emit } from "@/modules/events";
import { fileResponse } from "@/modules/intake/handlers";

/**
 * Files a client hands us outside the questionnaire, and files we hand them
 * (ADR 0025, Ayush 16 Sep: "There should be upload document section for the
 * client so that they can upload document on the client portal and then we
 * can access them").
 *
 * The same pipeline as a questionnaire upload, INTAKE-SPEC section 4: type by
 * magic bytes never by extension, images re-encoded with EXIF stripped, SVG
 * sanitised, PDF as is, ten megabytes each, stored outside the web root under
 * the client's own directory and served only through a route that has checked
 * who is asking. A file is not evidence: either side can remove one.
 *
 * A client's upload tells the team; a team upload tells the client. Two event
 * types rather than one with a flag, so the team's unread count never counts
 * the team's own uploads.
 */
export type StoredDocument = {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  hasThumb: boolean;
  note: string | null;
  by: IntakeParty;
  createdAt: Date;
};

export const MAX_FILES_PER_UPLOAD = 10;

export async function listDocuments(clientId: string): Promise<StoredDocument[]> {
  const rows = await db.clientDocument.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({
    id: r.id,
    name: r.originalName,
    mime: r.mimeType,
    sizeBytes: r.sizeBytes,
    hasThumb: r.thumbPath !== null,
    note: r.note,
    by: r.uploadedBy,
    createdAt: r.createdAt,
  }));
}

export type StoreResult = { stored: { id: string; name: string }[]; refused: { name: string; message: string }[] };

export async function storeDocuments(args: {
  clientId: string;
  businessName: string;
  files: File[];
  note: string;
  by: IntakeParty;
  actor: string;
}): Promise<StoreResult> {
  const stored: { id: string; name: string }[] = [];
  const refused: { name: string; message: string }[] = [];
  const note = args.note.trim().slice(0, 300) || null;
  for (const f of args.files.slice(0, MAX_FILES_PER_UPLOAD)) {
    if (f.size > MAX_FILE_BYTES) {
      refused.push({ name: f.name, message: REASON_TEXT.too_large });
      continue;
    }
    const buf = Buffer.from(await f.arrayBuffer());
    const r = await processUpload(buf);
    if (!r.ok) {
      refused.push({ name: f.name, message: REASON_TEXT[r.reason] });
      continue;
    }
    const storedPath = await writeClientFile(args.clientId, r.file.ext, r.file.data);
    const thumb = r.file.kind === "svg" ? await svgThumb(r.file.data) : r.file.thumb;
    const thumbPath = thumb ? await writeClientFile(args.clientId, "jpg", thumb) : null;
    const row = await db.clientDocument.create({
      data: {
        clientId: args.clientId,
        uploadedBy: args.by,
        originalName: safeName(f.name),
        mimeType: r.file.mime,
        sizeBytes: r.file.data.length,
        storedPath,
        thumbPath,
        note,
      },
    });
    stored.push({ id: row.id, name: row.originalName });
  }
  if (stored.length > 0) {
    await emit({
      type: args.by === IntakeParty.CLIENT ? "document.uploaded" : "document.added",
      projectId: null,
      actor: args.actor,
      payload: {
        clientId: args.clientId,
        businessName: args.businessName,
        count: stored.length,
        names: stored.map((s) => s.name).join(", ").slice(0, 300),
        note,
      },
    });
  }
  return { stored, refused };
}

/** GET a stored document for a viewer already known to be allowed. */
export async function serveDocument(clientId: string, docId: string, wantThumb: boolean): Promise<Response> {
  const doc = await db.clientDocument.findUnique({ where: { id: docId } });
  if (!doc || doc.clientId !== clientId) return new Response("Not found", { status: 404 });
  if (wantThumb) {
    if (!doc.thumbPath) return new Response("Not found", { status: 404 });
    return fileResponse(await readStored(doc.thumbPath), "image/jpeg", "thumb.jpg");
  }
  return fileResponse(await readStored(doc.storedPath), doc.mimeType, doc.originalName);
}

/** Row and files both, for a document that belongs to this client. False if it does not. */
export async function removeDocument(clientId: string, docId: string): Promise<boolean> {
  const doc = await db.clientDocument.findUnique({ where: { id: docId } });
  if (!doc || doc.clientId !== clientId) return false;
  await db.clientDocument.delete({ where: { id: doc.id } });
  await removeStored(doc.storedPath);
  if (doc.thumbPath) await removeStored(doc.thumbPath);
  return true;
}

export function safeName(name: string): string {
  return name.replace(/[\r\n"\\]/g, "_").slice(0, 300) || "file";
}

/** For the page: "2.4 MB", "640 KB". */
export function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
