import { z } from "zod";

/** INTAKE-SPEC section 5. The contract between the writer and the renderer. */

export const FIELD_TYPES = ["short_text", "long_text", "yes_no", "pick_one", "pick_many", "link", "upload", "image_choice"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

const key = z.string().regex(/^[a-z][a-z0-9_]*$/, "lowercase letters, digits and underscores, starting with a letter");

const option = z.object({ id: z.string().min(1).max(64), label: z.string().min(1).max(200) }).strict();
const imageOption = option.extend({ image: z.string().min(1).max(64) }).strict();

const base = { key, text: z.string().min(1).max(500), help: z.string().max(500).optional(), required: z.boolean().optional() };

export const questionSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("short_text") }).strict(),
  z.object({ ...base, type: z.literal("long_text") }).strict(),
  z.object({ ...base, type: z.literal("yes_no") }).strict(),
  z.object({ ...base, type: z.literal("pick_one"), options: z.array(option) }).strict(),
  z.object({ ...base, type: z.literal("pick_many"), options: z.array(option) }).strict(),
  z.object({ ...base, type: z.literal("link") }).strict(),
  z.object({ ...base, type: z.literal("upload"), max_files: z.number().int() }).strict(),
  z.object({ ...base, type: z.literal("image_choice"), options: z.array(imageOption), max_choices: z.number().int().optional() }).strict(),
]);
export type Question = z.infer<typeof questionSchema>;

const accessItem = z.object({ key, label: z.string().min(1).max(200), help: z.string().max(500).optional() }).strict();
export type AccessItem = z.infer<typeof accessItem>;

export const sectionSchema = z.object({
  key,
  title: z.string().min(1).max(200),
  intro: z.string().max(1000).optional(),
  access_items: z.array(accessItem).optional(),
  questions: z.array(questionSchema),
}).strict();
export type Section = z.infer<typeof sectionSchema>;

export const documentSchema = z.object({
  version: z.number(),
  title: z.string().min(1).max(200),
  intro: z.string().max(2000).optional(),
  sections: z.array(sectionSchema),
}).strict();
export type IntakeDocument = z.infer<typeof documentSchema>;

/** For reading a document already accepted by the importer. */
export function parseDocumentLoose(json: unknown): IntakeDocument | null {
  const r = documentSchema.safeParse(json);
  return r.success ? r.data : null;
}

export function allQuestions(doc: IntakeDocument): Question[] {
  return doc.sections.flatMap((s) => s.questions);
}

export function accessSection(doc: IntakeDocument): Section | undefined {
  return doc.sections.find((s) => s.access_items !== undefined);
}
