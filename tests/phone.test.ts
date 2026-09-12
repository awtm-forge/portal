import { describe, expect, it } from "vitest";
import { phoneDigits } from "@/lib/format";
import { hasCountryCode } from "@/lib/phone";

/**
 * Every WhatsApp link in the product, on the client's pages and on the team's,
 * is wa.me plus these digits. wa.me needs the country code, and on 12 Sep a
 * company number saved without one made a link that silently went nowhere.
 */
describe("a number we can build a WhatsApp link from", () => {
  it("takes a written country code, however it is spaced", () => {
    for (const ok of ["+91 99000 21188", "+919900021188", "+44 20 7946 0958", "+1 (415) 555-0100", "+65 9123 4567"]) {
      expect(hasCountryCode(ok), ok).toBe(true);
    }
  });

  it("refuses a number with no country code, which is the mistake that happens", () => {
    for (const bad of ["6394858141", "99000 21188", "099000 21188", "", "   ", "not a number", "91 99000 21188"]) {
      expect(hasCountryCode(bad), bad).toBe(false);
    }
  });

  it("cannot be decided by length: ten digits is a whole Singapore number and half an Indian one", () => {
    expect(phoneDigits("+65 9123 4567")).toHaveLength(10);
    expect(phoneDigits("6394858141")).toHaveLength(10);
    expect(hasCountryCode("+65 9123 4567")).toBe(true);
    expect(hasCountryCode("6394858141")).toBe(false);
  });

  it("hands wa.me the digits and nothing else", () => {
    expect(phoneDigits("+91 99000 21188")).toBe("919900021188");
  });
});
