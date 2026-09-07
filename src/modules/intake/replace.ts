import { db } from "@/lib/db";
import { allQuestions, type IntakeDocument } from "@/modules/intake/document";
import { readAnswers, readStringList } from "@/modules/intake/answers";

/**
 * INTAKE-SPEC 13.8 and section 10. Upload or replace the document. Every
 * existing answer is kept. Keys that vanish are hidden, keys that come back
 * are unhidden. Nothing a client typed is ever discarded.
 */
export async function upsertDocument(projectId: string, document: IntakeDocument, adminId: string): Promise<{ hidden: string[]; unhidden: string[] }> {
  return db.$transaction(async (tx) => {
    const existing = await tx.intake.findUnique({ where: { projectId } });
    if (!existing) {
      await tx.intake.create({
        data: { projectId, document, documentUploadedById: adminId, hiddenQuestionKeys: [], sectionsDone: [], answers: {}, accessGranted: {} },
      });
      return { hidden: [], unhidden: [] };
    }
    await tx.$executeRaw`SELECT id FROM Intake WHERE id = ${existing.id} FOR UPDATE`;
    const newKeys = new Set(allQuestions(document).map((q) => q.key));
    const answers = readAnswers(existing.answers);
    const previouslyHidden = new Set(readStringList(existing.hiddenQuestionKeys));
    const hidden = Object.keys(answers).filter((k) => !newKeys.has(k));
    const unhidden = [...previouslyHidden].filter((k) => newKeys.has(k));
    const sectionKeys = new Set(document.sections.map((s) => s.key));
    const sectionsDone = readStringList(existing.sectionsDone).filter((k) => sectionKeys.has(k));
    await tx.intake.update({
      where: { id: existing.id },
      data: {
        document,
        documentUploadedAt: new Date(),
        documentUploadedById: adminId,
        hiddenQuestionKeys: hidden,
        sectionsDone,
      },
    });
    return { hidden, unhidden };
  });
}
