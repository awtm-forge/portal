import { describe, expect, it } from "vitest";
import { linkEmail, linkEmailSubject } from "@/modules/notifications/link-email";

/**
 * The welcome with the client's link (CLAUDE.md 5.1), rewritten on 18 Sep at
 * Ayush's ask. The same letter twice, in the brand's paper and in plain text,
 * so whichever a mail app shows, the client reads the same words.
 */
const args = { contactName: "Asha Rao", businessName: "Sundara Living", link: "https://dashboard.awtmforge.com/p/abcDEF123_-xyz", whatsapp: "https://wa.me/919900021188" };

describe("the welcome email", () => {
  it("greets by first name in the subject and the heading", () => {
    expect(linkEmailSubject("Asha Rao")).toBe("Welcome, Asha: your awtm forge page");
    const m = linkEmail(args);
    expect(m.subject).toBe("Welcome, Asha: your awtm forge page");
    expect(m.text.startsWith("Welcome, Asha.")).toBe(true);
    expect(m.html).toContain("Welcome, Asha.");
  });

  it("carries the link as the button, as a line to copy, and in the text twin", () => {
    const m = linkEmail(args);
    expect(m.text).toContain(args.link);
    expect(m.html.split(`href="${args.link}"`).length - 1).toBe(2);
    expect(m.html).toContain(">Open your page<");
  });

  it("says the same things in both forms: the questionnaire, the code, and the rule about passwords", () => {
    const m = linkEmail(args);
    for (const line of ["First, ten minutes.", "six digit code", "No password, ever.", "We will never ask you for a password, an API key or a code", "Rahul"]) {
      expect(m.text, line).toContain(line);
      expect(m.html, line).toContain(line);
    }
  });

  it("links WhatsApp when a phone is set, and only then", () => {
    const withPhone = linkEmail(args);
    expect(withPhone.text).toContain("https://wa.me/919900021188");
    expect(withPhone.html).toContain(`href="https://wa.me/919900021188"`);
    const without = linkEmail({ ...args, whatsapp: null });
    expect(without.text).not.toContain("wa.me");
    expect(without.html).not.toContain("wa.me");
    expect(without.text).toContain("message me on WhatsApp");
  });

  it("shows a name or a business as typed, never as markup", () => {
    const m = linkEmail({ ...args, contactName: "<b>Asha</b> Rao", businessName: "Sundara & <i>Living</i>" });
    expect(m.html).not.toContain("<b>Asha</b>");
    expect(m.html).not.toContain("<i>Living</i>");
    expect(m.html).toContain("&lt;b&gt;Asha&lt;/b&gt;");
    expect(m.html).toContain("Sundara &amp; &lt;i&gt;Living&lt;/i&gt;");
  });

  it("loads nothing from anywhere: no stylesheet, script or image, and no em dash", () => {
    const m = linkEmail(args);
    expect(m.html).not.toMatch(/<link|<script|<img/i);
    expect(m.html).not.toContain("—");
    expect(m.text).not.toContain("—");
  });
});
