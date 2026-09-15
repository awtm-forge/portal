import { describe, expect, it } from "vitest";
import { tokenFromPastedLink } from "@/lib/link-token";

/** What the team pastes is a whole address from mail or WhatsApp, not a token. */
describe("the token inside a pasted client link", () => {
  const token = "xR3n_qPbz8Ke1vY6Ht0LmWcAdSf9UgJiOpQwErTyUiO";

  it("comes out of a full address on any host", () => {
    expect(tokenFromPastedLink(`https://dashboard.awtmforge.com/p/${token}`)).toBe(token);
    expect(tokenFromPastedLink(`http://localhost:3200/p/${token}`)).toBe(token);
  });

  it("survives a trailing path, a query string, a fragment and stray whitespace", () => {
    expect(tokenFromPastedLink(`  https://dashboard.awtmforge.com/p/${token}/intake `)).toBe(token);
    expect(tokenFromPastedLink(`https://dashboard.awtmforge.com/p/${token}?utm=x`)).toBe(token);
    expect(tokenFromPastedLink(`https://dashboard.awtmforge.com/p/${token}#top`)).toBe(token);
  });

  it("accepts the bare token too", () => {
    expect(tokenFromPastedLink(token)).toBe(token);
  });

  it("gives nothing for text that holds no token", () => {
    expect(tokenFromPastedLink("")).toBeNull();
    expect(tokenFromPastedLink("https://dashboard.awtmforge.com/admin/clients")).toBeNull();
    expect(tokenFromPastedLink("https://dashboard.awtmforge.com/p/short")).toBeNull();
    expect(tokenFromPastedLink("https://dashboard.awtmforge.com/p/has spaces in it and is long enough")).toBeNull();
  });
});
