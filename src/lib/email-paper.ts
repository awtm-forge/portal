/**
 * An email in the brand's paper (docs/BRAND.md), for the one message that is a
 * welcome rather than a notice (Ayush, 18 Sep: "more welcoming"). Everything
 * is a table with the styles written on it, because that is what mail clients
 * render the same way; no stylesheet, no script, no image, no tracking. The
 * words are the same as the plain text twin the caller sends beside it, so a
 * client whose mail app shows text sees the same letter.
 *
 * Every string that comes from a person is escaped here, once, so a business
 * called "<b>Sundara</b>" is shown as typed and never rendered.
 */
export type PaperEmail = {
  /** The line an inbox shows under the subject. Hidden in the body. */
  preheader: string;
  heading: string;
  lead: string;
  button: { label: string; href: string };
  /** The same address in words, for a mail app that drops the button. */
  copyLine: string;
  blocks: { lead: string; text: string }[];
  note: string;
  closing: { before: string; link?: { label: string; href: string }; after: string };
  signoff: string[];
  footer: string;
};

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

// The paper face's own values, written out because an email cannot read a
// token. Change them in step with globals.css.
const GROUND = "#f3eee6";
const SURFACE = "#f9f5ee";
const INK = "#141110";
const MUTED = "#4e4741";
const HAIRLINE = "#dcd3c5";
const ACCENT = "#a8561a";
const FILL = "#c96d1b";
const WORDMARK = "#e08638";

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function p(text: string, extra = ""): string {
  return `<p style="margin:0 0 16px;font-family:${SANS};font-size:16px;line-height:1.55;color:${INK};${extra}">${text}</p>`;
}

export function paperEmail(e: PaperEmail): string {
  const blocks = e.blocks
    .map((b) => p(`<strong style="font-weight:700;">${escapeHtml(b.lead)}</strong> ${escapeHtml(b.text)}`))
    .join("");
  const closing =
    escapeHtml(e.closing.before) +
    (e.closing.link
      ? ` <a href="${escapeHtml(e.closing.link.href)}" style="color:${ACCENT};text-decoration:underline;">${escapeHtml(e.closing.link.label)}</a>`
      : "") +
    escapeHtml(e.closing.after);
  const signoff = e.signoff.map((line, i) => (i === 0 ? escapeHtml(line) : `<span style="color:${MUTED};">${escapeHtml(line)}</span>`)).join("<br>");

  return [
    `<!DOCTYPE html>`,
    `<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">`,
    `<title>${escapeHtml(e.heading)}</title></head>`,
    `<body style="margin:0;padding:0;background:${GROUND};">`,
    `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${GROUND};">${escapeHtml(e.preheader)}</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${GROUND};">`,
    `<tr><td align="center" style="padding:32px 16px;">`,
    // Full width capped at 560, not 560 capped at full width: a table's
    // max-width is not honoured the way its width is, and on a phone the
    // card kept its 560 and ran off the screen (18 Sep).
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">`,
    `<tr><td style="padding:0 4px 18px;font-family:${SANS};font-size:22px;font-weight:800;letter-spacing:-0.02em;color:${INK};">awtm <span style="color:${WORDMARK};">forge</span></td></tr>`,
    `<tr><td style="background:${SURFACE};border:1px solid ${HAIRLINE};border-radius:12px;padding:36px 32px 28px;">`,
    `<h1 style="margin:0 0 14px;font-family:${SANS};font-size:28px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:${INK};">${escapeHtml(e.heading)}</h1>`,
    p(escapeHtml(e.lead), "margin-bottom:24px;"),
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:8px;background:${FILL};">`,
    `<a href="${escapeHtml(e.button.href)}" style="display:inline-block;padding:14px 22px;font-family:${SANS};font-size:15px;font-weight:700;color:${INK};text-decoration:none;border-radius:8px;">${escapeHtml(e.button.label)}</a>`,
    `</td></tr></table>`,
    // Only the address may break anywhere; the words before it wrap as words.
    `<p style="margin:14px 0 28px;font-family:${MONO};font-size:12px;line-height:1.6;color:${MUTED};">${escapeHtml(e.copyLine)}<br><a href="${escapeHtml(e.button.href)}" style="color:${ACCENT};word-break:break-all;">${escapeHtml(e.button.href)}</a></p>`,
    blocks,
    `<p style="margin:24px 0 0;padding-top:18px;border-top:1px solid ${HAIRLINE};font-family:${SANS};font-size:14px;line-height:1.55;color:${MUTED};">${escapeHtml(e.note)}</p>`,
    p(closing, "margin:24px 0 20px;"),
    `<p style="margin:0;font-family:${SANS};font-size:16px;line-height:1.5;color:${INK};">${signoff}</p>`,
    `</td></tr>`,
    `<tr><td style="padding:16px 4px 0;font-family:${SANS};font-size:12px;line-height:1.5;color:${MUTED};">${escapeHtml(e.footer)}</td></tr>`,
    `</table></td></tr></table></body></html>`,
  ].join("\n");
}
