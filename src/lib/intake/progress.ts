import { parseDocumentLoose, type IntakeDocument } from "@/lib/intake/document";

export type Progress = { total: number; done: number; sections: { key: string; title: string; done: boolean }[] };

/** A section is done when the client pressed "Save and carry on" from it. */
export function intakeProgress(documentJson: unknown, _answersJson: unknown, sectionsDoneJson: unknown): Progress {
  const doc: IntakeDocument | null = parseDocumentLoose(documentJson);
  const done = new Set(Array.isArray(sectionsDoneJson) ? (sectionsDoneJson as unknown[]).filter((k): k is string => typeof k === "string") : []);
  const sections = (doc?.sections ?? []).map((s) => ({ key: s.key, title: s.title, done: done.has(s.key) }));
  return { total: sections.length, done: sections.filter((s) => s.done).length, sections };
}
