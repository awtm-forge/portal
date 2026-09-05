import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateDocument } from "@/lib/intake/import";

const library = new Set(["logo-wordmark", "logo-monogram", "logo-emblem", "logo-mascot", "logo-abstract", "logo-combination"]);
const good = () => JSON.parse(readFileSync("prisma/seed/intake-kavya-2026-08-18.json", "utf8"));

function rules(doc: unknown) {
  const r = validateDocument(doc, library);
  return r.ok ? [] : r.failures.map((f) => `${f.rule}:${f.key ?? ""}`);
}

describe("importer, INTAKE-SPEC section 5", () => {
  it("accepts the seed document", () => {
    const r = validateDocument(good(), library);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.stats).toEqual({ sections: 5, questions: 26, accessItems: 6 });
  });

  it("names a duplicate key", () => {
    const d = good();
    d.sections[1].questions[0].key = "biz_what";
    expect(rules(d)).toContain("unique_keys:biz_what");
  });

  it("refuses an upload question in the access section", () => {
    const d = good();
    d.sections[4].questions.push({ key: "acc_shot", type: "upload", text: "A screenshot", max_files: 1 });
    expect(rules(d)).toContain("no_upload_in_access:acc_shot");
  });

  it("refuses an image key not in the library", () => {
    const d = good();
    d.sections[2].questions[2].options[0].image = "logo-emblem-v2";
    expect(rules(d)).toContain("image_key_exists:br_direction");
  });

  it("needs both sign-off fields, short_text and required", () => {
    const d = good();
    d.sections[4].questions = d.sections[4].questions.filter((q: { key: string }) => q.key !== "dec_signoff_email");
    expect(rules(d)).toContain("signoff_fields:dec_signoff_email");
    const e = good();
    e.sections[4].questions[0].required = false;
    expect(rules(e)).toContain("signoff_fields:dec_signoff_name");
  });

  it("refuses a ninth type, one option, and max_files out of range", () => {
    const d = good();
    d.sections[0].questions[0].type = "rating";
    expect(rules(d).some((r) => r.startsWith("shape:"))).toBe(true);
    const e = good();
    e.sections[0].questions[2].options = [{ id: "one", label: "One" }];
    expect(rules(e)).toContain("options_min_two:biz_volume");
    const f = good();
    f.sections[1].questions[9].max_files = 11;
    expect(rules(f)).toContain("upload_max_files:st_annoy");
  });

  it("wants exactly one access section and at most sixty questions", () => {
    const d = good();
    delete d.sections[4].access_items;
    expect(rules(d)).toContain("one_access_section:");
    const e = good();
    for (let i = 0; i < 40; i++) e.sections[0].questions.push({ key: `extra_${i}`, type: "short_text", text: "x" });
    expect(rules(e)).toContain("max_questions:");
  });

  it("lists every failure at once and saves nothing", () => {
    const d = good();
    d.version = 2;
    d.sections[1].questions[0].key = "biz_what";
    d.sections[2].questions[2].options[0].image = "missing";
    const r = validateDocument(d, library);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failures.length).toBeGreaterThanOrEqual(3);
  });
});
