"use server";

import { refreshTo, refreshWith } from "@/lib/admin-nav";
import { requireAdmin } from "@/modules/auth/admin";
import { deliverLink, sendQuestionnaire, withIntake } from "@/modules/clients";
import { readAnswers } from "@/modules/intake/answers";
import { validateDocument, type ImportFailure } from "@/modules/intake/import";
import { libraryKeys } from "@/modules/library";
import { takeFlashLink } from "../../../../actions";

export type ImportState = { failures?: ImportFailure[]; message?: string; json?: string };

/**
 * "Send the questionnaire" (Q12). Attaches the document to the client and,
 * the first time, emails their link, because now there is something on it.
 * A replacement later attaches quietly: the link has already gone.
 */
export async function importAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const admin = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  const client = await withIntake(clientId);
  if (!client) refreshTo("/admin/clients");

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
  const result = validateDocument(raw, await libraryKeys());
  if (!result.ok) return { json: text, failures: result.failures };

  const hasAnswers = client.intake ? Object.keys(readAnswers(client.intake.answers)).length > 0 : false;
  if (hasAnswers && formData.get("confirm") !== "on") {
    return { json: text, message: "Answers exist. Tick the line confirming that answers to removed keys are kept but hidden, then upload again." };
  }
  const firstTime = client.intake === null;
  await sendQuestionnaire(client.id, result.document, admin.id);

  let emailed = false;
  if (firstTime && !client.linkEmailedAt) {
    const token = await takeFlashLink(client.id);
    if (token) { await deliverLink(client.id, token); emailed = true; }
  }
  return refreshWith(`/admin/clients/${client.id}`, firstTime ? (emailed ? "Questionnaire sent, and their link emailed." : "Questionnaire sent. It is on their page.") : "Questionnaire replaced. Every answer is kept.");
}
