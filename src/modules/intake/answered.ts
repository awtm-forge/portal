import type { AnswerEntry, Answers } from "@/modules/intake/answers";
import type { IntakeDocument, Question, Section } from "@/modules/intake/document";

/**
 * When a question counts as answered (ADR 0027, Ayush 16 Sep: "client should
 * not be able to move forward without filling those. if none of the options
 * fits it, they put their remarks and then can move").
 *
 * One rule, read by the page before it lets a section close and by the server
 * before it marks one done or accepts a sending, so the two cannot disagree.
 * A question with words in it is answered by its words. A question with
 * options, a yes or no, or an upload is answered by a choice, a file, or a
 * line in the client's own words saying why none of that fits. "I do not
 * know" is a real answer to any of these, typed where the words go.
 */
export const NOT_ANSWERED = "Needs an answer, or a line on why none of these fits.";

export function isAnswered(q: Question, a: AnswerEntry | undefined): boolean {
  if (!a) return false;
  const note = typeof a.note === "string" && a.note.trim() !== "";
  switch (q.type) {
    case "short_text":
    case "long_text":
    case "link":
      return typeof a.value === "string" && a.value.trim() !== "";
    case "yes_no":
      return typeof a.value === "boolean" || note;
    case "pick_one":
      return (typeof a.value === "string" && q.options.some((o) => o.id === a.value)) || note;
    case "pick_many":
    case "image_choice": {
      const ids = Array.isArray(a.value) ? (a.value as string[]) : [];
      return q.options.some((o) => ids.includes(o.id)) || note;
    }
    case "upload":
      return (a.files?.length ?? 0) > 0 || note;
  }
}

/** The keys in a section that are not yet answered, in the section's order. */
export function unansweredIn(section: Section, answers: Answers): string[] {
  return section.questions.filter((q) => !isAnswered(q, answers[q.key])).map((q) => q.key);
}

/** The keys not yet answered across the whole document, in order. */
export function unansweredInDocument(doc: IntakeDocument, answers: Answers): string[] {
  return doc.sections.flatMap((s) => unansweredIn(s, answers));
}

/** Whether a question's type takes a "none of these fits" line at all. */
export function takesNote(q: Question): boolean {
  return q.type !== "short_text" && q.type !== "long_text" && q.type !== "link";
}
