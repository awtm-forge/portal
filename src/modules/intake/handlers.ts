import { NextResponse } from "next/server";
import { IntakeParty } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { MAX_FILE_BYTES, processUpload, REASON_TEXT, svgThumb } from "@/lib/files";
import { fail, json, sameOrigin } from "@/lib/http";
import { markSectionDone, readAnswers, saveAccess, saveAnswer, setFileList, submitIntake } from "@/modules/intake/answers";
import { askForChange } from "@/modules/intake/changes";
import { parseDocumentLoose } from "@/modules/intake/document";
import { LOCKED_MESSAGE, openForWriting } from "@/modules/intake/versions";
import { imageByKey } from "@/modules/library";
import { readStored, removeStored, writeClientFile } from "@/lib/storage";

export type IntakeActor = { clientId: string; enteredBy: "client" | "team"; canSubmit: boolean };

const ACTIONS = new Set(["save", "access", "section-done", "submit", "upload", "remove-file", "ask-change"]);
/** What the lock covers (ADR 0016). Not "access": those ticks are granted over the days after sending. */
const WRITES = new Set(["save", "section-done", "upload", "remove-file"]);

/** One dispatcher serves both bases: /p/[token]/intake/api and /admin/clients/[id]/intake/api. */
export async function handleIntakeAction(request: Request, action: string, actor: IntakeActor): Promise<NextResponse> {
  if (!sameOrigin(request)) return fail("Cross-site request refused.", 403);
  if (!ACTIONS.has(action)) return fail("No such action.", 404);
  const intake = await db.intake.findUnique({ where: { clientId: actor.clientId } });
  if (!intake) return fail("No questionnaire yet.", 404);
  // The same check runs again inside each write's transaction; this one is
  // so an upload is refused before its file is stored.
  if (WRITES.has(action) && !(await openForWriting(db, intake))) return fail(LOCKED_MESSAGE, 409);

  if (action === "upload") return handleUpload(request, intake.id, actor);

  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; } catch { return fail("Bad request."); }

  switch (action) {
    case "save": {
      const key = String(body.key ?? "");
      const r = await saveAnswer(intake.id, key, body.value, actor.enteredBy);
      return r.ok ? json({ ok: true, at: r.at }) : fail(r.message);
    }
    case "access": {
      const r = await saveAccess(intake.id, String(body.key ?? ""), body.granted === true);
      return r.ok ? json({ ok: true, at: r.at }) : fail(r.message);
    }
    case "section-done": {
      const r = await markSectionDone(intake.id, String(body.section ?? ""));
      return r.ok ? json({ ok: true, at: r.at }) : fail(r.message);
    }
    case "submit": {
      if (!actor.canSubmit) return fail("Only the client sends the questionnaire.", 403);
      const r = await submitIntake(intake.id, IntakeParty.CLIENT);
      return r.ok ? json({ ok: true, at: r.at }) : fail(r.message);
    }
    case "ask-change": {
      if (actor.enteredBy !== "client") return fail("Only the client asks to change their answers.", 403);
      const r = await askForChange(actor.clientId, String(body.note ?? ""));
      if (r.ok) return json({ ok: true });
      const why: Record<string, string> = {
        empty: "Say what needs changing, in a line.",
        not_sent: "It has not been sent yet, so you can change it directly.",
        already_asked: "You have already asked. We will open it and message you.",
        already_open: "It is open for changes now. Tap an answer to change it.",
      };
      return fail(why[r.reason]);
    }
    case "remove-file": {
      const fileId = String(body.fileId ?? "");
      const file = await db.intakeFile.findUnique({ where: { id: fileId } });
      if (!file || file.clientId !== actor.clientId) return fail("No such file.", 404);
      await db.intakeFile.delete({ where: { id: file.id } });
      await removeStored(file.storedPath);
      if (file.thumbPath) await removeStored(file.thumbPath);
      const r = await setFileList(intake.id, file.questionKey, (files) => files.filter((f) => f !== file.id), actor.enteredBy);
      return r.ok ? json({ ok: true, at: r.at }) : fail(r.message);
    }
  }
  return fail("No such action.", 404);
}

async function handleUpload(request: Request, intakeId: string, actor: IntakeActor): Promise<NextResponse> {
  let form: FormData;
  try { form = await request.formData(); } catch { return fail("Upload did not come through."); }
  const key = String(form.get("key") ?? "");
  const intake = await db.intake.findUnique({ where: { id: intakeId } });
  if (!intake) return fail("No questionnaire.", 404);
  const doc = parseDocumentLoose(intake.document);
  const q = doc?.sections.flatMap((s) => s.questions).find((x) => x.key === key);
  if (!q || q.type !== "upload") return fail("Not an upload question.");
  const existing = readAnswers(intake.answers)[key]?.files ?? [];
  const incoming = form.getAll("file").filter((f): f is File => f instanceof File);
  if (incoming.length === 0) return fail("No file.");
  if (existing.length + incoming.length > q.max_files) return fail(`Up to ${q.max_files} files on this question.`);

  const stored: { id: string; name: string; mime: string; hasThumb: boolean }[] = [];
  const refused: { name: string; message: string }[] = [];
  for (const f of incoming) {
    if (f.size > MAX_FILE_BYTES) { refused.push({ name: f.name, message: REASON_TEXT.too_large }); continue; }
    const buf = Buffer.from(await f.arrayBuffer());
    const r = await processUpload(buf);
    if (!r.ok) { refused.push({ name: f.name, message: REASON_TEXT[r.reason] }); continue; }
    const storedPath = await writeClientFile(actor.clientId, r.file.ext, r.file.data);
    const thumb = r.file.kind === "svg" ? await svgThumb(r.file.data) : r.file.thumb;
    const thumbPath = thumb ? await writeClientFile(actor.clientId, "jpg", thumb) : null;
    const row = await db.intakeFile.create({
      data: {
        clientId: actor.clientId,
        questionKey: key,
        storedPath,
        thumbPath,
        originalName: safeName(f.name),
        mimeType: r.file.mime,
        sizeBytes: r.file.data.length,
      },
    });
    stored.push({ id: row.id, name: row.originalName, mime: row.mimeType, hasThumb: !!thumbPath });
  }
  if (stored.length) {
    await setFileList(intakeId, key, (files) => [...files, ...stored.map((s) => s.id)], actor.enteredBy);
  }
  return json({ ok: true, stored, refused });
}

function safeName(name: string): string {
  return name.replace(/[\r\n"\\]/g, "_").slice(0, 300) || "file";
}

/** GET a stored file for a viewer already known to be allowed. */
export async function serveClientFile(clientId: string, fileId: string, wantThumb: boolean): Promise<Response> {
  const file = await db.intakeFile.findUnique({ where: { id: fileId } });
  if (!file || file.clientId !== clientId) return new Response("Not found", { status: 404 });
  if (wantThumb) {
    if (!file.thumbPath) return new Response("Not found", { status: 404 });
    return bytes(await readStored(file.thumbPath), "image/jpeg", "thumb.jpg");
  }
  return bytes(await readStored(file.storedPath), file.mimeType, file.originalName);
}

export async function serveLibraryImage(key: string): Promise<Response> {
  const img = await imageByKey(key);
  if (!img) return new Response("Not found", { status: 404 });
  return bytes(await readStored(img.storedPath), img.mimeType, `${key}.${img.storedPath.split(".").pop()}`);
}

function bytes(data: Buffer, mime: string, name: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": mime,
    "Content-Length": String(data.length),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Content-Disposition": `inline; filename="${name.replace(/[^\w.\- ]/g, "_")}"`,
    "X-Robots-Tag": "noindex, nofollow",
  };
  if (mime === "image/svg+xml") headers["Content-Security-Policy"] = "sandbox; default-src 'none'; style-src 'unsafe-inline'";
  return new Response(new Uint8Array(data), { status: 200, headers });
}
