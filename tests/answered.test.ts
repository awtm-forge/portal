import { describe, expect, it } from "vitest";
import { isAnswered, notAnsweredLine, takesNote, unansweredIn, unansweredInDocument } from "@/modules/intake/answered";
import type { AnswerEntry } from "@/modules/intake/answers";
import type { IntakeDocument, Question } from "@/modules/intake/document";

/** An entry as the store holds it: who and when are always there. */
const e = (partial: Partial<AnswerEntry>): AnswerEntry => ({ entered_by: "client", at: "2026-09-16T00:00:00.000Z", ...partial });

/**
 * ADR 0027. A question is answered by its words, by a choice, by a file, or
 * by a line saying why none of the options fits; the same rule the page and
 * the server both read.
 */
const opts = [{ id: "a", label: "A" }, { id: "b", label: "B" }];
const q = {
  text: { key: "t", text: "T", type: "short_text" } as Question,
  long: { key: "l", text: "L", type: "long_text" } as Question,
  link: { key: "k", text: "K", type: "link" } as Question,
  yn: { key: "y", text: "Y", type: "yes_no" } as Question,
  one: { key: "o", text: "O", type: "pick_one", options: opts } as Question,
  many: { key: "m", text: "M", type: "pick_many", options: opts } as Question,
  img: { key: "i", text: "I", type: "image_choice", options: [{ id: "x", label: "X", image: "logo-wordmark" }] } as Question,
  up: { key: "u", text: "U", type: "upload", max_files: 3 } as Question,
};

describe("what counts as answered", () => {
  it("a text question is answered by its words, and only its words", () => {
    expect(isAnswered(q.text, undefined)).toBe(false);
    expect(isAnswered(q.text, e({ value: "   " }))).toBe(false);
    expect(isAnswered(q.text, e({ value: "I do not know" }))).toBe(true);
    expect(isAnswered(q.long, e({ note: "a note is not the words" }))).toBe(false);
    expect(isAnswered(q.link, e({ value: "https://example.com" }))).toBe(true);
  });

  it("a yes or no is answered by either, or by a line saying it is not that simple", () => {
    expect(isAnswered(q.yn, undefined)).toBe(false);
    expect(isAnswered(q.yn, e({ value: false }))).toBe(true);
    expect(isAnswered(q.yn, e({ note: "it depends on the season" }))).toBe(true);
    expect(isAnswered(q.yn, e({ note: "  " }))).toBe(false);
  });

  it("a choice is answered by a real option, or by a line saying none fits", () => {
    expect(isAnswered(q.one, e({ value: "a" }))).toBe(true);
    expect(isAnswered(q.one, e({ value: "zzz" })), "not one of the options").toBe(false);
    expect(isAnswered(q.one, e({ note: "we use a marketplace, not our own store" }))).toBe(true);
    expect(isAnswered(q.many, e({ value: [] }))).toBe(false);
    expect(isAnswered(q.many, e({ value: ["b"] }))).toBe(true);
    expect(isAnswered(q.img, e({ value: [] }))).toBe(false);
    expect(isAnswered(q.img, e({ note: "none of these directions" }))).toBe(true);
  });

  it("an upload is answered by a file, or by a line saying there is nothing to add", () => {
    expect(isAnswered(q.up, e({ files: [] }))).toBe(false);
    expect(isAnswered(q.up, e({ files: ["f1"] }))).toBe(true);
    expect(isAnswered(q.up, e({ note: "no photos yet, the shoot is next week" }))).toBe(true);
  });

  it("lists what is missing in the section's order, and across the document", () => {
    const doc = { version: 1, title: "T", intro: "", sections: [
      { key: "s1", title: "S1", questions: [q.text, q.one] },
      { key: "s2", title: "S2", questions: [q.up] },
    ] } as unknown as IntakeDocument;
    const answers = { t: e({ value: "words" }) };
    expect(unansweredIn(doc.sections[0], answers)).toEqual(["o"]);
    expect(unansweredInDocument(doc, answers)).toEqual(["o", "u"]);
    expect(unansweredInDocument(doc, { ...answers, o: e({ note: "none" }), u: e({ files: ["f"] }) })).toEqual([]);
  });

  it("knows which types take the line at all, and marks each in words that fit it", () => {
    expect(takesNote(q.text)).toBe(false);
    expect(takesNote(q.one)).toBe(true);
    expect(takesNote(q.up)).toBe(true);
    expect(notAnsweredLine(q.text)).not.toMatch(/none of these/);
    expect(notAnsweredLine(q.one)).toMatch(/none of these fits/);
  });
});
