"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { readAnswers } from "@/lib/intake/answers";
import { validateDocument, type ImportFailure } from "@/lib/intake/import";
import { upsertDocument } from "@/lib/intake/replace";

export type ImportState = { failures?: ImportFailure[]; message?: string; json?: string };

export async function importAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const admin = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "");
  const project = await db.project.findUnique({ where: { id: projectId }, include: { intake: { select: { answers: true } } } });
  if (!project) redirect("/admin");

  let text = String(formData.get("json") ?? "").trim();
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > 2 * 1024 * 1024) return { message: "That file is over 2 MB, which no questionnaire is." };
    text = (await file.text()).trim();
  }
  if (!text) return { message: "Paste the JSON or choose the file." };

  let raw: unknown;
  try { raw = JSON.parse(text); } catch (e) {
    return { json: text, failures: [{ rule: "json", message: `Not valid JSON: ${(e as Error).message}` }] };
  }
  const keys = new Set((await db.imageLibrary.findMany({ select: { key: true } })).map((r) => r.key));
  const result = validateDocument(raw, keys);
  if (!result.ok) return { json: text, failures: result.failures };

  const hasAnswers = project.intake ? Object.keys(readAnswers(project.intake.answers)).length > 0 : false;
  if (hasAnswers && formData.get("confirm") !== "on") {
    return { json: text, message: "Answers exist. Tick the line confirming that answers to removed keys are kept but hidden, then upload again." };
  }
  await upsertDocument(project.id, result.document, admin.id);
  redirect(`/admin/projects/${project.id}`);
}
