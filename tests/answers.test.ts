import { describe, expect, it } from "vitest";
import { cleanValue } from "@/lib/intake/answers";
import type { Question } from "@/lib/intake/document";

describe("answer values by type, INTAKE-SPEC section 3", () => {
  it("validates the sign-off email by key", () => {
    const q: Question = { key: "dec_signoff_email", type: "short_text", text: "Their email", required: true };
    expect(cleanValue(q, "not-an-email").ok).toBe(false);
    expect(cleanValue(q, "Kavya@Example.in")).toEqual({ ok: true, value: "kavya@example.in" });
  });

  it("prepends https to a bare link and refuses nonsense", () => {
    const q: Question = { key: "st_url", type: "link", text: "Your store" };
    expect(cleanValue(q, "kavyaappliances.in")).toEqual({ ok: true, value: "https://kavyaappliances.in" });
    expect(cleanValue(q, "nope").ok).toBe(false);
  });

  it("keeps pick_many to known ids and image_choice within max_choices", () => {
    const pm: Question = { key: "st_gateway", type: "pick_many", text: "Payments", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] };
    expect(cleanValue(pm, ["a", "zzz", "a"])).toEqual({ ok: true, value: ["a"] });
    const ic: Question = { key: "br_direction", type: "image_choice", text: "Which", max_choices: 1, options: [{ id: "a", label: "A", image: "x" }, { id: "b", label: "B", image: "y" }] };
    expect(cleanValue(ic, ["a", "b"]).ok).toBe(false);
  });

  it("stores yes_no as a boolean with an optional note", () => {
    const q: Question = { key: "st_abroad", type: "yes_no", text: "Abroad?" };
    expect(cleanValue(q, { value: true, note: "Gulf" })).toEqual({ ok: true, value: true, note: "Gulf" });
    expect(cleanValue(q, { value: "yes" }).ok).toBe(false);
  });

  it("never accepts a value for an upload question through save", () => {
    const q: Question = { key: "st_annoy", type: "upload", text: "Shots", max_files: 3 };
    expect(cleanValue(q, ["f_1"]).ok).toBe(false);
  });
});
