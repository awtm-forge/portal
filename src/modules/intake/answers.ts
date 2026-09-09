import { IntakeChangeStatus, IntakeParty, Phase } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { emit } from "@/modules/events";
import { can, transition } from "@/modules/projects/phase";
import { parseDocumentLoose, type Question } from "@/modules/intake/document";
import { SIGNOFF_EMAIL_KEY, SIGNOFF_NAME_KEY } from "@/modules/intake/import";
import { LOCKED_MESSAGE, openForWriting, snapshotVersion } from "@/modules/intake/versions";

/** INTAKE-SPEC section 6. One entry per question key. */
export type AnswerEntry = {
  value?: string | boolean | string[];
  note?: string;
  files?: string[];
  entered_by: "client" | "team";
  at: string;
};
export type Answers = Record<string, AnswerEntry>;

export function readAnswers(json: unknown): Answers {
  return json && typeof json === "object" && !Array.isArray(json) ? (json as Answers) : {};
}
export function readStringList(json: unknown): string[] {
  return Array.isArray(json) ? json.filter((k): k is string => typeof k === "string") : [];
}
export function readBoolMap(json: unknown): Record<string, boolean> {
  return json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, boolean>) : {};
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns the cleaned value or a message. Never accepts a shape the type does not have. */
export function cleanValue(q: Question, raw: unknown): { ok: true; value: AnswerEntry["value"]; note?: string } | { ok: false; message: string } {
  switch (q.type) {
    case "short_text": {
      if (typeof raw !== "string") return { ok: false, message: "text expected" };
      const v = raw.trim().slice(0, 500);
      if (q.key === SIGNOFF_EMAIL_KEY && v && !EMAIL.test(v)) return { ok: false, message: "That does not look like an email." };
      return { ok: true, value: q.key === SIGNOFF_EMAIL_KEY ? v.toLowerCase() : v };
    }
    case "long_text": {
      if (typeof raw !== "string") return { ok: false, message: "text expected" };
      return { ok: true, value: raw.trim().slice(0, 8000) };
    }
    case "link": {
      if (typeof raw !== "string") return { ok: false, message: "text expected" };
      let v = raw.trim().slice(0, 500);
      if (!v) return { ok: true, value: "" };
      if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
      try { const u = new URL(v); if (!u.hostname.includes(".")) throw new Error(); } catch { return { ok: false, message: "That does not look like a web address." }; }
      return { ok: true, value: v };
    }
    case "yes_no": {
      const o = raw && typeof raw === "object" ? (raw as { value?: unknown; note?: unknown }) : { value: raw };
      if (o.value !== true && o.value !== false && o.value !== null && o.value !== undefined) return { ok: false, message: "yes or no" };
      const note = typeof o.note === "string" ? o.note.trim().slice(0, 4000) : undefined;
      return { ok: true, value: o.value === null || o.value === undefined ? undefined : o.value, note };
    }
    case "pick_one": {
      if (raw === "" || raw === null) return { ok: true, value: undefined };
      if (typeof raw !== "string" || !q.options.some((o) => o.id === raw)) return { ok: false, message: "not one of the options" };
      return { ok: true, value: raw };
    }
    case "pick_many":
    case "image_choice": {
      if (!Array.isArray(raw) || !raw.every((x) => typeof x === "string")) return { ok: false, message: "a list expected" };
      const ids = new Set(q.options.map((o) => o.id));
      const v = [...new Set(raw as string[])].filter((x) => ids.has(x));
      if (q.type === "image_choice" && v.length > (q.max_choices ?? 1)) return { ok: false, message: `Pick ${q.max_choices ?? 1} at most.` };
      return { ok: true, value: v };
    }
    case "upload":
      return { ok: false, message: "uploads go through the upload route" };
  }
}

export type SaveResult = { ok: true; at: string } | { ok: false; message: string };

/**
 * INTAKE-SPEC 13.1 and 13.7. Row-locked read, merge one key, write. Two
 * devices saving different keys cannot overwrite each other.
 */
export async function saveAnswer(intakeId: string, key: string, raw: unknown, enteredBy: "client" | "team"): Promise<SaveResult> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM Intake WHERE id = ${intakeId} FOR UPDATE`;
    const row = await tx.intake.findUnique({ where: { id: intakeId }, include: { client: true } });
    if (!row) return { ok: false, message: "no questionnaire" };
    if (!(await openForWriting(tx, row))) return { ok: false, message: LOCKED_MESSAGE };
    const doc = parseDocumentLoose(row.document);
    if (!doc) return { ok: false, message: "bad document" };
    const q = doc.sections.flatMap((s) => s.questions).find((x) => x.key === key);
    if (!q) return { ok: false, message: "no such question" };
    const cleaned = cleanValue(q, raw);
    if (!cleaned.ok) return cleaned;

    const answers = readAnswers(row.answers);
    const at = new Date().toISOString();
    const entry: AnswerEntry = { entered_by: enteredBy, at };
    if (cleaned.value !== undefined) entry.value = cleaned.value;
    if (cleaned.note !== undefined) entry.note = cleaned.note;
    if (entry.value === undefined && !entry.note) delete answers[key];
    else answers[key] = entry;

    await tx.intake.update({ where: { id: intakeId }, data: { answers, lastSavedAt: new Date() } });

    // The sign-off person they name is held on the client until there is a
    // project to put them on. The new-project form offers them first, and a
    // project already waiting in intake is told too, so admin can decide.
    if (enteredBy === "client" && (key === SIGNOFF_EMAIL_KEY || key === SIGNOFF_NAME_KEY)) {
      const email = (answers[SIGNOFF_EMAIL_KEY]?.value as string | undefined) ?? "";
      const name = (answers[SIGNOFF_NAME_KEY]?.value as string | undefined) ?? "";
      const differs = email !== "" && email.toLowerCase() !== row.client.contactEmail.toLowerCase();
      await tx.client.update({
        where: { id: row.clientId },
        data: differs
          ? { proposedSignoffEmail: email, proposedSignoffName: name || null, proposedAt: new Date() }
          : { proposedSignoffEmail: null, proposedSignoffName: null, proposedAt: null },
      });
    }
    return { ok: true, at };
  });
}

/** INTAKE-SPEC 13.5: the access section stores booleans only. */
export async function saveAccess(intakeId: string, key: string, granted: boolean): Promise<SaveResult> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM Intake WHERE id = ${intakeId} FOR UPDATE`;
    const row = await tx.intake.findUnique({ where: { id: intakeId } });
    if (!row) return { ok: false, message: "no questionnaire" };
    const doc = parseDocumentLoose(row.document);
    const items = doc?.sections.find((s) => s.access_items)?.access_items ?? [];
    if (!items.some((i) => i.key === key)) return { ok: false, message: "no such access item" };
    const map = readBoolMap(row.accessGranted);
    map[key] = granted === true;
    await tx.intake.update({ where: { id: intakeId }, data: { accessGranted: map, lastSavedAt: new Date() } });
    return { ok: true, at: new Date().toISOString() };
  });
}

export async function markSectionDone(intakeId: string, sectionKey: string): Promise<SaveResult> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM Intake WHERE id = ${intakeId} FOR UPDATE`;
    const row = await tx.intake.findUnique({ where: { id: intakeId } });
    if (!row) return { ok: false, message: "no questionnaire" };
    if (!(await openForWriting(tx, row))) return { ok: false, message: LOCKED_MESSAGE };
    const doc = parseDocumentLoose(row.document);
    if (!doc?.sections.some((s) => s.key === sectionKey)) return { ok: false, message: "no such section" };
    const done = new Set(readStringList(row.sectionsDone));
    done.add(sectionKey);
    await tx.intake.update({ where: { id: intakeId }, data: { sectionsDone: [...done], lastSavedAt: new Date() } });
    return { ok: true, at: new Date().toISOString() };
  });
}

/** INTAKE-SPEC 13.4: the two sign-off fields are the only required ones. */
export function missingRequired(documentJson: unknown, answersJson: unknown): string[] {
  const doc = parseDocumentLoose(documentJson);
  const answers = readAnswers(answersJson);
  if (!doc) return [];
  return doc.sections.flatMap((s) => s.questions).filter((q) => q.required && !(typeof answers[q.key]?.value === "string" && (answers[q.key].value as string).length > 0)).map((q) => q.key);
}

/**
 * Sending. The first time it records the sending, makes version 1 and moves
 * a project waiting in intake on. After that the answers are locked (ADR
 * 0016): a sending goes through only under an open change request, which it
 * closes as the next version, and it moves no phase.
 */
export async function submitIntake(intakeId: string, by: IntakeParty = IntakeParty.CLIENT): Promise<SaveResult> {
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM Intake WHERE id = ${intakeId} FOR UPDATE`;
    const row = await tx.intake.findUnique({
      where: { id: intakeId },
      include: { client: { include: { projects: { where: { phase: Phase.INTAKE }, orderBy: { createdAt: "desc" }, take: 1 } } } },
    });
    if (!row) return { ok: false as const, message: "no questionnaire" };
    const missing = missingRequired(row.document, row.answers);
    if (missing.length) return { ok: false as const, message: "Who says yes, and their email, are the two answers we need before sending." };
    const doc = parseDocumentLoose(row.document);
    const firstSubmission = row.submittedAt === null;
    const open = firstSubmission
      ? null
      : await tx.intakeChangeRequest.findFirst({ where: { clientId: row.clientId, status: IntakeChangeStatus.OPEN } });
    if (!firstSubmission && !open) return { ok: false as const, message: LOCKED_MESSAGE };

    const now = new Date();
    await tx.intake.update({
      where: { id: intakeId },
      data: { submittedAt: row.submittedAt ?? now, lastSavedAt: now, sectionsDone: doc?.sections.map((s) => s.key) ?? [] },
    });
    const snap = await snapshotVersion(tx, row.clientId, row.answers, row.accessGranted, by);
    if (open) {
      await tx.intakeChangeRequest.update({ where: { id: open.id }, data: { status: IntakeChangeStatus.SENT, sentAt: now, version: snap.version } });
    }
    // PORTAL-SPEC 5.2: submitting is what moves a project out of intake, if
    // one is waiting there. Usually there is none yet: the questionnaire comes
    // first now (Q12), and a project started afterwards begins past this
    // gate. Sending changes later does not move anything again.
    const waiting = row.client.projects[0];
    if (firstSubmission && waiting && can(waiting.phase, "intake_submitted")) {
      await transition(tx, waiting, "intake_submitted");
    }
    return {
      ok: true as const,
      at: now.toISOString(),
      first: firstSubmission,
      version: snap.version,
      changed: snap.changed.length,
      clientId: row.clientId,
      projectId: waiting?.id ?? null,
      projectName: waiting?.name ?? null,
      businessName: row.client.businessName,
    };
  });

  if (result.ok && result.first) {
    await emit({
      type: "intake.submitted",
      projectId: result.projectId,
      actor: "client",
      payload: { clientId: result.clientId, projectName: result.projectName, businessName: result.businessName },
    });
  } else if (result.ok) {
    await emit({
      type: "intake.changes_sent",
      projectId: null,
      actor: by === IntakeParty.TEAM ? "team" : "client",
      payload: { clientId: result.clientId, businessName: result.businessName, changed: result.changed, version: result.version },
    });
  }
  return result.ok ? { ok: true, at: result.at } : result;
}

/** Attach or detach a stored file on an upload question, under the row lock. */
export async function setFileList(intakeId: string, key: string, mutate: (files: string[]) => string[], enteredBy: "client" | "team"): Promise<SaveResult> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM Intake WHERE id = ${intakeId} FOR UPDATE`;
    const row = await tx.intake.findUnique({ where: { id: intakeId } });
    if (!row) return { ok: false, message: "no questionnaire" };
    if (!(await openForWriting(tx, row))) return { ok: false, message: LOCKED_MESSAGE };
    const answers = readAnswers(row.answers);
    const files = mutate(answers[key]?.files ?? []);
    const at = new Date().toISOString();
    if (files.length === 0) delete answers[key];
    else answers[key] = { files, entered_by: enteredBy, at };
    await tx.intake.update({ where: { id: intakeId }, data: { answers, lastSavedAt: new Date() } });
    return { ok: true, at };
  });
}

/** INTAKE-SPEC section 6, the answers document handed to the scope draft. */
export function answersDocument(
  client: { id: string; businessName: string },
  intake: { document: unknown; answers: unknown; accessGranted: unknown; submittedAt: Date | null; hiddenQuestionKeys: unknown },
  version: number | null = null,
) {
  const doc = parseDocumentLoose(intake.document);
  return {
    questionnaire_version: doc?.version ?? 1,
    // ADR 0016: which sending these answers are. Null while still open.
    answers_version: version,
    client: client.businessName,
    submitted_at: intake.submittedAt ? intake.submittedAt.toISOString() : null,
    answers: readAnswers(intake.answers),
    access_granted: readBoolMap(intake.accessGranted),
    hidden_question_keys: readStringList(intake.hiddenQuestionKeys),
  };
}
