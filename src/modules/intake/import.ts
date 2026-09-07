import { z } from "zod";
import { documentSchema, FIELD_TYPES, type IntakeDocument } from "@/modules/intake/document";

/**
 * INTAKE-SPEC section 5, "Rules the importer enforces". Every rule is checked
 * and every failure is returned, naming the rule and the key. A document with
 * any failure is never saved.
 */
export type ImportFailure = { rule: string; key?: string; message: string };

export type ImportResult =
  | { ok: true; document: IntakeDocument; stats: { sections: number; questions: number; accessItems: number } }
  | { ok: false; failures: ImportFailure[] };

export const MAX_QUESTIONS = 60;
export const SIGNOFF_NAME_KEY = "dec_signoff_name";
export const SIGNOFF_EMAIL_KEY = "dec_signoff_email";

export function validateDocument(raw: unknown, libraryKeys: Set<string>): ImportResult {
  const failures: ImportFailure[] = [];

  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      failures.push(shapeFailure(raw, issue));
    }
    return { ok: false, failures };
  }
  const doc = parsed.data;

  if (doc.version !== 1) failures.push({ rule: "version", message: `version must be 1, got ${doc.version}` });

  const seen = new Map<string, string>();
  const noteKey = (k: string, where: string) => {
    const prev = seen.get(k);
    if (prev) failures.push({ rule: "unique_keys", key: k, message: `${k} appears twice, in ${prev} and ${where}` });
    else seen.set(k, where);
  };
  for (const s of doc.sections) {
    noteKey(s.key, `section ${s.key}`);
    for (const a of s.access_items ?? []) noteKey(a.key, `access items of ${s.key}`);
    for (const q of s.questions) noteKey(q.key, `section ${s.key}`);
  }

  const questions = doc.sections.flatMap((s) => s.questions.map((q) => ({ q, section: s })));

  for (const { q } of questions) {
    if (!(FIELD_TYPES as readonly string[]).includes(q.type)) {
      failures.push({ rule: "field_type", key: q.key, message: `${q.key} has type ${q.type}, which is not one of the eight` });
    }
    if (q.type === "pick_one" || q.type === "pick_many" || q.type === "image_choice") {
      if (q.options.length < 2) failures.push({ rule: "options_min_two", key: q.key, message: `${q.key} needs at least two options` });
      const ids = new Set<string>();
      for (const o of q.options) {
        if (ids.has(o.id)) failures.push({ rule: "options_unique_ids", key: q.key, message: `${q.key} has option id ${o.id} twice` });
        ids.add(o.id);
      }
    }
    if (q.type === "image_choice") {
      for (const o of q.options) {
        if (!libraryKeys.has(o.image)) {
          failures.push({ rule: "image_key_exists", key: q.key, message: `${q.key} option ${o.id} names image ${o.image}, which is not in the image library` });
        }
      }
      if (q.max_choices !== undefined && (q.max_choices < 1 || q.max_choices > q.options.length)) {
        failures.push({ rule: "max_choices_range", key: q.key, message: `${q.key} max_choices must be between 1 and ${q.options.length}` });
      }
    }
    if (q.type === "upload" && (q.max_files < 1 || q.max_files > 10)) {
      failures.push({ rule: "upload_max_files", key: q.key, message: `${q.key} max_files must be between 1 and 10, got ${q.max_files}` });
    }
  }

  const accessSections = doc.sections.filter((s) => s.access_items !== undefined);
  if (accessSections.length !== 1) {
    failures.push({ rule: "one_access_section", message: `exactly one section must have access_items, found ${accessSections.length}` });
  }
  for (const s of accessSections) {
    if (s.access_items && s.access_items.length === 0) {
      failures.push({ rule: "access_items_nonempty", key: s.key, message: `${s.key} has an empty access_items list` });
    }
    for (const q of s.questions) {
      if (q.type === "upload") {
        failures.push({ rule: "no_upload_in_access", key: q.key, message: `${q.key} is an upload question inside the access section. Nothing can invite a screenshot of a password.` });
      }
      if (q.required && q.key !== SIGNOFF_NAME_KEY && q.key !== SIGNOFF_EMAIL_KEY) {
        failures.push({ rule: "access_required_only_signoff", key: q.key, message: `${q.key} is required inside the access section. Only ${SIGNOFF_NAME_KEY} and ${SIGNOFF_EMAIL_KEY} may be.` });
      }
    }
  }

  for (const k of [SIGNOFF_NAME_KEY, SIGNOFF_EMAIL_KEY]) {
    const found = questions.find(({ q }) => q.key === k);
    if (!found) failures.push({ rule: "signoff_fields", key: k, message: `${k} is missing. It must exist, be short_text, and be required.` });
    else if (found.q.type !== "short_text") failures.push({ rule: "signoff_fields", key: k, message: `${k} must be short_text, got ${found.q.type}` });
    else if (!found.q.required) failures.push({ rule: "signoff_fields", key: k, message: `${k} must be required` });
  }

  if (questions.length > MAX_QUESTIONS) {
    failures.push({ rule: "max_questions", message: `${questions.length} questions. The limit is ${MAX_QUESTIONS}.` });
  }

  if (failures.length) return { ok: false, failures };
  return {
    ok: true,
    document: doc,
    stats: {
      sections: doc.sections.length,
      questions: questions.length,
      accessItems: accessSections[0]?.access_items?.length ?? 0,
    },
  };
}

function shapeFailure(raw: unknown, issue: z.core.$ZodIssue): ImportFailure {
  const path = issue.path.map(String);
  const key = keyAtPath(raw, path);
  const where = path.length ? path.join(".") : "document";
  return { rule: "shape", key, message: `${where}: ${issue.message}` };
}

function keyAtPath(raw: unknown, path: string[]): string | undefined {
  let node: unknown = raw;
  let lastKey: string | undefined;
  for (const p of path) {
    if (node && typeof node === "object") {
      const rec = node as Record<string, unknown>;
      if (typeof rec.key === "string") lastKey = rec.key;
      node = rec[p];
    } else break;
  }
  if (node && typeof node === "object" && typeof (node as Record<string, unknown>).key === "string") {
    lastKey = (node as Record<string, unknown>).key as string;
  }
  return lastKey;
}
