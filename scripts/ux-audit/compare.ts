/**
 * Builds docs/ux-overhaul/07-before-after.html: every frame the camera took,
 * before beside after, at each width, with the friction it answers. The
 * images are referenced, not embedded, so the page stays small and the PNGs
 * stay the single copy.
 *
 *   npx tsx scripts/ux-audit/compare.ts
 */
import { existsSync, readdirSync, writeFileSync } from "node:fs";

const root = "docs/ux-overhaul";
const before = `${root}/audit/before`;
const after = `${root}/audit/after`;
const WIDTHS = ["390", "768", "1440"];

/** Which friction entries a frame answers, for the caption. */
const ANSWERS: Record<string, string> = {
  "client-00-way-in": "F-10 login from the bare domain",
  "client-02-login-start": "F-11 no void under the form",
  "client-03-login-code": "F-15 the wrong-code line and the resend cooldown",
  "client-04-code-start": "F-11",
  "client-05-code-enter": "F-15",
  "client-06-code-wrong": "F-15 message beside the field",
  "client-10-home-questionnaire-pending": "F-02 one-line wordmark, F-03 steps, F-17 folds",
  "client-11-questionnaire-section-1": "F-05 sticky action",
  "client-12-questionnaire-after-carry-on": "F-05",
  "client-20-home-agreement-draft": "F-02, F-03, F-11",
  "client-21-home-agreement-sent": "F-02, F-03, F-04 nav fade",
  "client-22-agreement-to-agree": "F-05 sticky I agree, F-19 stamp line",
  "client-23-home-agreed": "F-02, F-03",
  "client-24-agreement-agreed": "F-19 agreed line under the title",
  "client-25-home-building": "F-02, F-03, F-17",
  "client-26-home-review": "F-04 nav fade",
  "client-27-review": "F-05 sticky choice",
  "client-28-thanks": "unchanged by design",
  "client-29-home-delivered": "F-12 one delivered card",
  "client-30-home-day30-due": "F-12",
  "client-31-day30": "unchanged by design",
  "client-32-invoices": "F-11",
  "client-33-updates-empty": "F-14 grouped by day, read state",
  "client-34-questionnaire-locked": "F-07 no dead placeholders, F-08 ask at the top",
  "client-35-questionnaire-asked": "F-07",
  "client-36-questionnaire-changing": "F-05 sticky Send the changes",
  "client-37-home-closed": "D-01, F-13",
  "client-38-home-cancelled": "D-01, F-13 closed on [date]",
  "client-39-invoice-print": "F-18 print button",
  "client-40-agreement-print": "F-18 print button",
  "admin-00-login": "F-31 locked-out line",
  "admin-01-setup": "type floor",
  "admin-02-dashboard": "F-20 waiting on, F-22 cards on a phone, F-33",
  "admin-03-clients": "F-22",
  "admin-04-client-new": "F-26",
  "admin-05-client-questionnaire-open": "F-26 help folded, F-27 details fold",
  "admin-06-intake-open": "type floor",
  "admin-07-intake-upload": "F-28 file picker, checkbox before the button",
  "admin-08-client-link": "F-26, F-34 rotate asks first",
  "admin-09-client-locked": "F-26, F-27",
  "admin-10-client-asked": "F-29 decline wording",
  "admin-11-client-changing": "F-26",
  "admin-12-intake-sent": "type floor",
  "admin-13-project-new": "F-21 phone bar",
  "admin-20-project-agreement_draft": "F-23 folds, waiting-on line",
  "admin-20-project-agreement_sent": "F-23",
  "admin-20-project-agreed": "F-23",
  "admin-20-project-building": "F-23, F-24 cancel behind a confirm",
  "admin-20-project-in_review": "F-23",
  "admin-20-project-delivered": "F-23",
  "admin-21-project-cancelled": "F-25 no forms on an ended project",
  "admin-22-agreement-editor": "F-21",
  "admin-23-updates": "F-21",
  "admin-30-library": "F-32 grid, delete asks first",
  "admin-31-settings": "F-30 toast instead of a flag",
};

const names = [...new Set(readdirSync(before).filter((f) => f.endsWith(".png")).map((f) => f.replace(/--\d+\.png$/, "")))].sort();
const groups = [
  { title: "The client", names: names.filter((n) => n.startsWith("client-")) },
  { title: "The team", names: names.filter((n) => n.startsWith("admin-")) },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const cell = (dir: string, name: string, w: string) => {
  const rel = `${dir.replace(`${root}/`, "")}/${name}--${w}.png`;
  return existsSync(`${dir}/${name}--${w}.png`) ? `<a href="${rel}"><img loading="lazy" src="${rel}" alt=""></a>` : `<p class="missing">no frame</p>`;
};

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>awtm forge UX overhaul, before and after</title>
<style>
  :root { color-scheme: dark; --ground:#141110; --surface:#1b1715; --ink:#ede7dc; --muted:#a69c8e; --rule:#2e2925; --ember:#e08536; }
  body { margin: 0; background: var(--ground); color: var(--ink); font: 15px/1.5 Georgia, serif; }
  header { padding: 28px 32px 18px; border-bottom: 1px solid var(--rule); position: sticky; top: 0; background: var(--ground); z-index: 2; }
  h1 { margin: 0; font: 600 24px/1.1 "Helvetica Neue", Arial, sans-serif; letter-spacing: -0.02em; }
  h1 b { color: var(--ember); font-weight: 600; }
  header p { margin: 8px 0 0; color: var(--muted); font-size: 14px; }
  .tabs { display: flex; gap: 8px; margin-top: 14px; }
  .tabs button { font: 12px ui-monospace, Menlo, monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--ember); background: none; border: 1px solid var(--ember); border-radius: 999px; padding: 6px 14px; cursor: pointer; }
  .tabs button[aria-pressed="true"] { background: var(--ember); color: #181008; }
  h2 { font: 600 18px/1.2 "Helvetica Neue", Arial, sans-serif; margin: 34px 32px 6px; }
  .frame { border-top: 1px solid var(--rule); padding: 18px 32px 26px; }
  .frame h3 { margin: 0 0 4px; font: 500 12px ui-monospace, Menlo, monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .frame p.why { margin: 0 0 12px; color: var(--muted); font-size: 13.5px; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
  .pair > div { min-width: 0; }
  .pair span { display: block; font: 11px ui-monospace, Menlo, monospace; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
  .pair img { width: 100%; height: auto; display: block; border: 1px solid var(--rule); border-radius: 2px; background: var(--surface); }
  .pair a { display: block; max-height: 760px; overflow: auto; border-radius: 2px; }
  .missing { color: var(--muted); font-size: 13px; }
  .w { display: none; } .w.on { display: block; }
  @media (max-width: 800px) { .pair { grid-template-columns: 1fr; } header, h2, .frame { padding-left: 16px; padding-right: 16px; } }
</style>
<header>
  <h1>awtm <b>forge</b>, before and after</h1>
  <p>Every screen the audit camera took, before the overhaul on the left and after on the right. Generated on ${new Date().toISOString().slice(0, 10)} from docs/ux-overhaul/audit. Scroll inside a frame to see the whole page.</p>
  <div class="tabs" role="group" aria-label="Width">${WIDTHS.map((w) => `<button type="button" data-w="${w}" aria-pressed="${w === "390"}">${w} px</button>`).join("")}</div>
</header>
${groups.map((g) => `<h2>${g.title}</h2>${g.names.map((n) => `
<section class="frame" id="${n}">
  <h3>${esc(n)}</h3>
  <p class="why">${esc(ANSWERS[n] ?? "")}</p>
  ${WIDTHS.map((w) => `<div class="w${w === "390" ? " on" : ""}" data-w="${w}"><div class="pair"><div><span>Before, ${w}</span>${cell(before, n, w)}</div><div><span>After, ${w}</span>${cell(after, n, w)}</div></div></div>`).join("")}
</section>`).join("")}`).join("")}
<script>
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
    const w = b.dataset.w;
    document.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    document.querySelectorAll(".w").forEach((el) => el.classList.toggle("on", el.dataset.w === w));
  }));
</script>
`;
writeFileSync(`${root}/07-before-after.html`, html);
console.log(`wrote ${root}/07-before-after.html with ${names.length} frames`);
