import { describe, expect, it } from "vitest";
import { seal, unseal } from "@/lib/seal";

/**
 * The sealed copy of a client's link (ADR 0021). It is the one secret in this
 * system that is stored so it can be read back, so what it promises is worth
 * a test: the same value comes out, nothing else does, and a tampered value
 * fails rather than decrypting to rubbish.
 */
describe("sealing a client's link", () => {
  it("gives back exactly what went in", () => {
    const token = "xR3n_qPbz8Ke1vY6Ht0LmWcAdSf9UgJiOpQwErTyUiO";
    expect(unseal(seal(token))).toBe(token);
  });

  it("never looks like what went in", () => {
    const token = "xR3n_qPbz8Ke1vY6Ht0LmWcAdSf9UgJiOpQwErTyUiO";
    const sealed = seal(token);
    expect(sealed).not.toContain(token);
    expect(sealed).not.toContain(token.slice(0, 12));
  });

  it("seals the same value differently every time, so two clients cannot be matched by eye", () => {
    const token = "the-same-token-twice";
    expect(seal(token)).not.toBe(seal(token));
  });

  it("refuses a tampered value rather than returning rubbish", () => {
    const sealed = seal("a real link");
    const bent = sealed.slice(0, -4) + (sealed.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
    expect(unseal(bent)).toBeNull();
  });

  it("returns nothing for a link that was never sealed", () => {
    expect(unseal(null)).toBeNull();
    expect(unseal("")).toBeNull();
    expect(unseal("not-a-sealed-value")).toBeNull();
  });
});
