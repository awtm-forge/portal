/**
 * Does any text sit on top of other text, or spill out of the box that holds
 * it, on any screen in either zone at any width?
 *
 * Written 14 Sep after a stage label in the client rail overlapped the next
 * one. Eyeballing found that once; this measures it, so it is found the same
 * way every time and on the screens nobody thought to look at.
 *
 * Two things are checked, and both are about what a person can actually see:
 *
 *   1. Spill. A leaf of text wider than its own box, unless that box scrolls
 *      or clips on purpose. This is what the rail bug was.
 *   2. Cover. A leaf of text with something else drawn on top of it, found by
 *      asking the browser what is at three points across the middle of it.
 *      A hit test rather than rectangle arithmetic, because rectangles lie:
 *      text inside a closed <details> still reports a box, and so does text
 *      scrolled out of the admin's nav on a phone. Those were false alarms in
 *      the first two runs of this script, 494 and 48 of them. A cover that
 *      wraps the text completely is skipped too: that is a row-wide link, not
 *      something hiding a word.
 *
 * Plus the page scrolling sideways, which is the coarse version of the same
 * question.
 *
 * The viewport is tall on purpose: a hit test only works on what is laid out
 * in view, so the page is given room to be in view all at once.
 *
 *   npx tsx scripts/ux-audit/overlap.ts [base]
 */
import { config } from "dotenv";
config({ path: `${process.cwd()}/.env`, quiet: true });

import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "@playwright/test";
import { closeDb, freshLink, INTAKE_SLUG, query, SEED_SLUG } from "../../tests/e2e/fixtures";

const BASE = process.argv[2] ?? "http://localhost:3200";
const HOST = new URL(BASE).hostname;
const SHOTS = `${process.cwd()}/docs/ux-overhaul/audit/overlap`;
const WIDTHS = [390, 700, 900, 1024, 1280, 1440];
const THEMES = ["dark", "light"] as const;
const ADMIN_EMAIL = "overlap@example.invalid";

import { PROBE, type Finding } from "./probe";

async function check(page: Page, name: string, path: string, width: number, theme: string) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  const findings = (await page.evaluate(PROBE)) as Finding[];
  if (findings.length === 0) return 0;
  console.log(`\n${name}  ${width}  ${theme}  ${path}`);
  for (const f of findings.slice(0, 8)) console.log(`  ${f.kind.padEnd(9)} ${String(f.by).padStart(4)}px  ${f.what}`);
  if (findings.length > 8) console.log(`  and ${findings.length - 8} more`);
  await page.screenshot({ path: `${SHOTS}/${name}--${width}--${theme}.png`, fullPage: true });
  return findings.length;
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const seed = await freshLink(SEED_SLUG);
  const open = await freshLink(INTAKE_SLUG);

  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  const adminId = `ov${Date.now()}`;
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, 'Overlap check', 'x', NOW(3))", [adminId, ADMIN_EMAIL]);
  const adminToken = randomBytes(32).toString("base64url");
  await query(
    "INSERT INTO AdminSession (id, tokenHash, adminUserId, createdAt, expiresAt, lastSeenAt) VALUES (?, ?, ?, NOW(3), DATE_ADD(NOW(3), INTERVAL 2 HOUR), NOW(3))",
    [`${adminId}s`, createHash("sha256").update(adminToken).digest("hex"), adminId],
  );

  const clientCookies: { name: string; value: string; domain: string; path: string }[] = [];
  for (const who of [seed, open]) {
    const raw = randomBytes(32).toString("base64url");
    await query(
      "INSERT INTO ClientSession (id, clientId, tokenHash, createdAt, expiresAt, lastSeenAt) VALUES (?, ?, ?, NOW(3), DATE_ADD(NOW(3), INTERVAL 2 HOUR), NOW(3))",
      [`ov${Math.random().toString(36).slice(2, 10)}`, who.clientId, createHash("sha256").update(raw).digest("hex")],
    );
    clientCookies.push({ name: `awtm_c_${who.clientId}`, value: raw, domain: HOST, path: "/" });
  }

  const pages: [string, string][] = [
    // The team.
    ["admin-projects", "/admin"],
    ["admin-project", `/admin/projects/${seed.projectId}`],
    ["admin-agreement", `/admin/projects/${seed.projectId}/agreement`],
    ["admin-updates", `/admin/projects/${seed.projectId}/updates`],
    ["admin-invoices", `/admin/projects/${seed.projectId}/invoices`],
    ["admin-clients", "/admin/clients"],
    ["admin-client", `/admin/clients/${seed.clientId}`],
    ["admin-link", `/admin/clients/${seed.clientId}/link`],
    ["admin-intake", `/admin/clients/${seed.clientId}/intake`],
    ["admin-notifications", "/admin/notifications"],
    ["admin-library", "/admin/library"],
    ["admin-settings", "/admin/settings"],
    ["admin-login", "/admin/login"],
    // The client.
    ["client-home", `/p/${seed.token}`],
    ["client-home-open", `/p/${open.token}`],
    ["client-questionnaire", `/p/${open.token}/intake`],
    ["client-agreement", `/p/${seed.token}/agreement`],
    ["client-invoices", `/p/${seed.token}/invoices`],
    ["client-updates", `/p/${seed.token}/updates`],
    ["client-login", "/p/login"],
    ["way-in", "/"],
  ];

  const browser = await chromium.launch();
  let total = 0;
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      const ctx = await browser.newContext({ viewport: { width, height: 3000 }, deviceScaleFactor: 1 });
      await ctx.addCookies([
        { name: "awtm_admin", value: adminToken, domain: HOST, path: "/" },
        { name: "awtm_theme", value: theme, domain: HOST, path: "/" },
        ...clientCookies,
      ]);
      const page = await ctx.newPage();
      for (const [name, path] of pages) total += await check(page, name, path, width, theme);
      await ctx.close();
    }
    console.log(`${width} done`);
  }
  await browser.close();

  await query("DELETE FROM ClientSession WHERE clientId IN (?, ?)", [seed.clientId, open.clientId]);
  await query("DELETE FROM AdminSession WHERE adminUserId = ?", [adminId]);
  await query("DELETE FROM AdminUser WHERE id = ?", [adminId]);
  await closeDb();
  console.log(`\n${total === 0 ? "nothing overlaps and nothing spills" : `${total} findings`} across ${pages.length} screens, ${WIDTHS.length} widths, both themes`);
  process.exit(total === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(String(e).slice(0, 400));
  await closeDb().catch(() => {});
  process.exit(1);
});
