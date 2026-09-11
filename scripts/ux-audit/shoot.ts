/**
 * The audit camera: every screen of both portals, in every reachable state,
 * at three widths, saved as full-page PNGs. Used for the before set and the
 * after set of the UX overhaul (docs/ux-overhaul/audit/).
 *
 *   npx tsx scripts/ux-audit/shoot.ts http://127.0.0.1:3210 docs/ux-overhaul/audit/before
 *
 * Runs against a local server on the local database only. It moves the seed
 * project through its phases to photograph each one and puts it back.
 * Each shot is independent: a failure is logged and the run carries on.
 */
import { config } from "dotenv";
config({ path: ".env", quiet: true });
import { createHash, randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { closeDb, day30Open, freshLink, INTAKE_SLUG, query, resetRateLimits, SEED_SLUG, setPhase, takeoverLatestCode } from "../../tests/e2e/fixtures";

const base = process.argv[2] ?? "http://127.0.0.1:3210";
const out = process.argv[3] ?? "docs/ux-overhaul/audit/before";
/** ONLY=home-intake,login WIDTHS=1440 narrows a rerun to the frames that failed. */
const only = (process.env.ONLY ?? "").split(",").filter(Boolean);
const widthFilter = (process.env.WIDTHS ?? "").split(",").filter(Boolean);
const WIDTHS: { name: string; width: number; height: number; mobile: boolean }[] = [
  { name: "390", width: 390, height: 844, mobile: true },
  { name: "768", width: 768, height: 1024, mobile: false },
  { name: "1440", width: 1440, height: 900, mobile: false },
].filter((w) => widthFilter.length === 0 || widthFilter.includes(w.name));
const ADMIN_EMAIL = "ux-audit@example.invalid";
const failures: string[] = [];
const logFile = `${out}.shoot.log`;
function log(line: string) { appendFileSync(logFile, `${new Date().toISOString().slice(11, 19)} ${line}\n`); }

async function shot(page: Page, name: string, width: string) {
  log(`shot ${name}--${width}`);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/${name}--${width}.png`, fullPage: true, timeout: 15_000 });
}
async function attempt(label: string, fn: () => Promise<void>) {
  if (only.length > 0 && !only.includes(label)) return;
  log(`begin ${label}`);
  try { await fn(); } catch (e) { const m = `${label}: ${String(e).split("\n")[0].slice(0, 160)}`; failures.push(m); log(`FAIL ${m}`); }
}
async function newPage(browser: Browser, w: (typeof WIDTHS)[number]): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: w.width, height: w.height }, isMobile: w.mobile, hasTouch: w.mobile, deviceScaleFactor: 1 });
  ctx.setDefaultTimeout(15_000);
  ctx.setDefaultNavigationTimeout(20_000);
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.dismiss().catch(() => undefined));
  return { ctx, page };
}

async function signInClient(page: Page, token: string, projectId: string) {
  await resetRateLimits();
  // Codes pile up across widths; the app caps how many can be live at once.
  await query("DELETE FROM OneTimeCode WHERE consumedAt IS NULL AND clientId = (SELECT clientId FROM Project WHERE id = ?)", [projectId]);
  await page.goto(`${base}/p/${token}`);
  await page.getByRole("button", { name: /email me a code/i }).click();
  await page.getByLabel(/six digit code/i).waitFor();
  await page.getByLabel(/six digit code/i).fill(await takeoverLatestCode(projectId, "LOGIN"));
  await page.getByRole("button", { name: /open my page/i }).click();
  await page.getByRole("navigation", { name: "Your pages" }).waitFor();
}

async function mintAdmin(): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("UPDATE IntakeChangeRequest SET decidedById = NULL WHERE decidedById IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, setupTokenHash, setupExpiresAt, createdAt) VALUES (?, ?, ?, NULL, ?, ?, NOW(3))",
    [`uxa${Date.now()}`, ADMIN_EMAIL, "Audit", hash, new Date(Date.now() + 3600_000)]);
  return token;
}
async function signInAdmin(page: Page) {
  const token = await mintAdmin();
  await page.goto(`${base}/admin/setup/${token}`);
  await page.getByLabel(/^password/i).fill("a-long-enough-passphrase");
  await page.getByLabel(/again/i).fill("a-long-enough-passphrase");
  await page.getByRole("button", { name: /set it and sign in/i }).click();
  await page.getByRole("heading", { name: /^projects$/i }).waitFor();
}

async function clientShots(browser: Browser, w: (typeof WIDTHS)[number], kavya: Awaited<ReturnType<typeof freshLink>>, sundara: Awaited<ReturnType<typeof freshLink>>) {
  const { ctx, page } = await newPage(browser, w);
  const W = w.name;

  await attempt("way-in", async () => { await page.goto(`${base}/`); await shot(page, "client-00-way-in", W); });
  await attempt("not-found", async () => { await page.goto(`${base}/p/nosuchtokenatall`); await shot(page, "client-01-not-found", W); });
  await attempt("login", async () => {
    await page.goto(`${base}/p/login`); await shot(page, "client-02-login-start", W);
    await page.getByLabel(/your email/i).fill("nobody@example.invalid");
    await page.getByRole("button", { name: /email me a code/i }).click();
    await page.getByLabel(/six digit code/i).waitFor(); await shot(page, "client-03-login-code", W);
  });
  await attempt("code-screen", async () => {
    await resetRateLimits();
    await page.goto(`${base}/p/${kavya.token}`); await shot(page, "client-04-code-start", W);
    await page.getByRole("button", { name: /email me a code/i }).click();
    await page.getByLabel(/six digit code/i).waitFor(); await shot(page, "client-05-code-enter", W);
    await page.getByLabel(/six digit code/i).fill("000000");
    await page.getByRole("button", { name: /open my page/i }).click();
    await page.getByRole("button", { name: /open my page/i }).waitFor();
    await page.waitForTimeout(600); await shot(page, "client-06-code-wrong", W);
  });

  // Kavya: questionnaire open.
  await attempt("home-intake", async () => {
    await ctx.clearCookies(); await signInClient(page, kavya.token, kavya.projectId);
    await shot(page, "client-10-home-questionnaire-pending", W);
    await page.goto(`${base}/p/${kavya.token}/intake`);
    await page.getByRole("button", { name: "Save and carry on" }).waitFor();
    await shot(page, "client-11-questionnaire-section-1", W);
    await page.getByRole("button", { name: "Save and carry on" }).click();
    await page.waitForTimeout(900);
    await shot(page, "client-12-questionnaire-after-carry-on", W);
  });

  // Sundara through the phases.
  const [proj] = await query<{ phase: string; deliveredAt: Date | null; thanksSeenAt: Date | null }>("SELECT phase, deliveredAt, thanksSeenAt FROM Project WHERE id = ?", [sundara.projectId]);
  const [agr] = await query<{ agreedAt: Date | null }>("SELECT agreedAt FROM Agreement WHERE projectId = ?", [sundara.projectId]);
  const day30Before = await query<{ unlocksAt: Date; openedAt: Date | null; metricAfterSubmittedAt: Date | null }>("SELECT unlocksAt, openedAt, metricAfterSubmittedAt FROM Day30 WHERE projectId = ?", [sundara.projectId]);

  await attempt("sundara-phases", async () => {
    await ctx.clearCookies();
    await query("UPDATE Day30 SET unlocksAt = DATE_ADD(NOW(3), INTERVAL 30 DAY) WHERE projectId = ?", [sundara.projectId]);
    await query("UPDATE Agreement SET agreedAt = NULL WHERE projectId = ?", [sundara.projectId]);
    await setPhase(sundara.projectId, "AGREEMENT_DRAFT");
    await signInClient(page, sundara.token, sundara.projectId);
    await shot(page, "client-20-home-agreement-draft", W);
    await setPhase(sundara.projectId, "AGREEMENT_SENT");
    await page.goto(`${base}/p/${sundara.token}`); await shot(page, "client-21-home-agreement-sent", W);
    await page.goto(`${base}/p/${sundara.token}/agreement`); await shot(page, "client-22-agreement-to-agree", W);
    await query("UPDATE Agreement SET agreedAt = COALESCE(?, NOW(3)) WHERE projectId = ?", [agr?.agreedAt ?? null, sundara.projectId]);
    await setPhase(sundara.projectId, "AGREED");
    await page.goto(`${base}/p/${sundara.token}`); await shot(page, "client-23-home-agreed", W);
    await page.goto(`${base}/p/${sundara.token}/agreement`); await shot(page, "client-24-agreement-agreed", W);
    await setPhase(sundara.projectId, "BUILDING");
    await page.goto(`${base}/p/${sundara.token}`); await shot(page, "client-25-home-building", W);
    const roundId = `uxa${Date.now()}`;
    const [{ n }] = await query<{ n: number | null }>("SELECT MAX(roundNumber) AS n FROM ReviewRound WHERE projectId = ?", [sundara.projectId]);
    await query("INSERT INTO ReviewRound (id, projectId, roundNumber, sentAt, finishedWorkUrl, outcome) VALUES (?, ?, ?, NOW(3), 'https://staging.example/finished', 'OPEN')", [roundId, sundara.projectId, Number(n ?? 0) + 1]);
    await setPhase(sundara.projectId, "IN_REVIEW");
    await page.goto(`${base}/p/${sundara.token}`); await shot(page, "client-26-home-review", W);
    await page.goto(`${base}/p/${sundara.token}/review`); await shot(page, "client-27-review", W);
    await query("DELETE FROM ReviewRound WHERE id = ?", [roundId]);
    await query("UPDATE Project SET deliveredAt = COALESCE(deliveredAt, NOW(3)), thanksSeenAt = NULL WHERE id = ?", [sundara.projectId]);
    await setPhase(sundara.projectId, "DELIVERED");
    await page.goto(`${base}/p/${sundara.token}/thanks`); await shot(page, "client-28-thanks", W);
    await page.goto(`${base}/p/${sundara.token}`); await shot(page, "client-29-home-delivered", W);
    await day30Open(sundara.projectId);
    await page.goto(`${base}/p/${sundara.token}`); await shot(page, "client-30-home-day30-due", W);
    await page.goto(`${base}/p/${sundara.token}/day30`); await shot(page, "client-31-day30", W);
    await page.goto(`${base}/p/${sundara.token}/invoices`); await shot(page, "client-32-invoices", W);
    await page.goto(`${base}/p/${sundara.token}/updates`); await shot(page, "client-33-updates-empty", W);
    await page.goto(`${base}/p/${sundara.token}/intake`); await shot(page, "client-34-questionnaire-locked", W);
    await query("INSERT INTO IntakeChangeRequest (id, clientId, status, note, askedBy, askedAt) VALUES (?, ?, 'ASKED', 'The platform is wrong.', 'CLIENT', NOW(3))", [`uxq${Date.now()}`, sundara.clientId]);
    await page.goto(`${base}/p/${sundara.token}/intake`); await shot(page, "client-35-questionnaire-asked", W);
    await query("UPDATE IntakeChangeRequest SET status = 'OPEN', decidedAt = NOW(3) WHERE clientId = ? AND status = 'ASKED'", [sundara.clientId]);
    await page.goto(`${base}/p/${sundara.token}/intake`); await shot(page, "client-36-questionnaire-changing", W);
    await query("DELETE FROM IntakeChangeRequest WHERE clientId = ?", [sundara.clientId]);
    await setPhase(sundara.projectId, "CLOSED");
    await page.goto(`${base}/p/${sundara.token}`); await shot(page, "client-37-home-closed", W);
    await query("UPDATE Project SET cancelledAt = NOW(3), cancelReason = 'Audit' WHERE id = ?", [sundara.projectId]);
    await setPhase(sundara.projectId, "CANCELLED");
    await page.goto(`${base}/p/${sundara.token}`); await shot(page, "client-38-home-cancelled", W);
    await query("UPDATE Project SET cancelledAt = NULL, cancelReason = NULL WHERE id = ?", [sundara.projectId]);
    const [inv] = await query<{ id: string }>("SELECT id FROM Invoice WHERE projectId = ? ORDER BY issuedAt LIMIT 1", [sundara.projectId]);
    if (inv) { await page.goto(`${base}/invoice/${inv.id}/print`); await shot(page, "client-39-invoice-print", W); }
    await page.goto(`${base}/agreement/${sundara.token}/print`); await shot(page, "client-40-agreement-print", W);
  });

  // Put the seed project back.
  await query("UPDATE Project SET phase = ?, deliveredAt = ?, thanksSeenAt = ? WHERE id = ?", [proj.phase, proj.deliveredAt, proj.thanksSeenAt, sundara.projectId]);
  await query("UPDATE Agreement SET agreedAt = ? WHERE projectId = ?", [agr?.agreedAt ?? null, sundara.projectId]);
  if (day30Before[0]) await query("UPDATE Day30 SET unlocksAt = ?, openedAt = ?, metricAfterSubmittedAt = ? WHERE projectId = ?", [day30Before[0].unlocksAt, day30Before[0].openedAt, day30Before[0].metricAfterSubmittedAt, sundara.projectId]);
  await ctx.close();
}

async function adminShots(browser: Browser, w: (typeof WIDTHS)[number], kavya: Awaited<ReturnType<typeof freshLink>>, sundara: Awaited<ReturnType<typeof freshLink>>) {
  const { ctx, page } = await newPage(browser, w);
  const W = w.name;
  await attempt("admin-login-page", async () => { await page.goto(`${base}/admin/login`); await shot(page, "admin-00-login", W); });
  await attempt("admin-setup-page", async () => { const t = await mintAdmin(); await page.goto(`${base}/admin/setup/${t}`); await shot(page, "admin-01-setup", W); });
  await attempt("admin-signin", async () => { await signInAdmin(page); await shot(page, "admin-02-dashboard", W); });
  await attempt("admin-clients", async () => {
    await page.goto(`${base}/admin/clients`); await shot(page, "admin-03-clients", W);
    await page.goto(`${base}/admin/clients/new`); await shot(page, "admin-04-client-new", W);
    await page.goto(`${base}/admin/clients/${kavya.clientId}`); await shot(page, "admin-05-client-questionnaire-open", W);
    await page.goto(`${base}/admin/clients/${kavya.clientId}/intake`); await shot(page, "admin-06-intake-open", W);
    await page.goto(`${base}/admin/clients/${kavya.clientId}/intake/upload`); await shot(page, "admin-07-intake-upload", W);
    await page.goto(`${base}/admin/clients/${kavya.clientId}/link`); await shot(page, "admin-08-client-link", W);
    await page.goto(`${base}/admin/clients/${sundara.clientId}`); await shot(page, "admin-09-client-locked", W);
    await query("INSERT INTO IntakeChangeRequest (id, clientId, status, note, askedBy, askedAt) VALUES (?, ?, 'ASKED', 'The platform is wrong.', 'CLIENT', NOW(3))", [`uxq${Date.now()}`, sundara.clientId]);
    await page.goto(`${base}/admin/clients/${sundara.clientId}`); await shot(page, "admin-10-client-asked", W);
    await query("UPDATE IntakeChangeRequest SET status = 'OPEN', decidedAt = NOW(3) WHERE clientId = ? AND status = 'ASKED'", [sundara.clientId]);
    await page.goto(`${base}/admin/clients/${sundara.clientId}`); await shot(page, "admin-11-client-changing", W);
    await query("DELETE FROM IntakeChangeRequest WHERE clientId = ?", [sundara.clientId]);
    await page.goto(`${base}/admin/clients/${sundara.clientId}/intake`); await shot(page, "admin-12-intake-sent", W);
    await page.goto(`${base}/admin/clients/${sundara.clientId}/projects/new`); await shot(page, "admin-13-project-new", W);
  });
  await attempt("admin-project", async () => {
    const [proj] = await query<{ phase: string }>("SELECT phase FROM Project WHERE id = ?", [sundara.projectId]);
    for (const ph of ["AGREEMENT_DRAFT", "AGREEMENT_SENT", "AGREED", "BUILDING", "IN_REVIEW", "DELIVERED"] as const) {
      await setPhase(sundara.projectId, ph);
      await page.goto(`${base}/admin/projects/${sundara.projectId}`); await shot(page, `admin-20-project-${ph.toLowerCase()}`, W);
    }
    await query("UPDATE Project SET cancelledAt = NOW(3), cancelReason = 'Audit' WHERE id = ?", [sundara.projectId]);
    await setPhase(sundara.projectId, "CANCELLED");
    await page.goto(`${base}/admin/projects/${sundara.projectId}`); await shot(page, "admin-21-project-cancelled", W);
    await query("UPDATE Project SET cancelledAt = NULL, cancelReason = NULL WHERE id = ?", [sundara.projectId]);
    await setPhase(sundara.projectId, proj.phase);
    await page.goto(`${base}/admin/projects/${sundara.projectId}/agreement`); await shot(page, "admin-22-agreement-editor", W);
    await page.goto(`${base}/admin/projects/${sundara.projectId}/updates`); await shot(page, "admin-23-updates", W);
  });
  await attempt("admin-misc", async () => {
    await page.goto(`${base}/admin/library`); await shot(page, "admin-30-library", W);
    await page.goto(`${base}/admin/settings`); await shot(page, "admin-31-settings", W);
  });
  await ctx.close();
}

async function main() {
  mkdirSync(out, { recursive: true });
  const kavya = await freshLink(INTAKE_SLUG);
  const sundara = await freshLink(SEED_SLUG);
  const kavyaDone = await query<{ sectionsDone: unknown }>("SELECT sectionsDone FROM Intake WHERE clientId = ?", [kavya.clientId]);
  const browser = await chromium.launch();
  for (const w of WIDTHS) {
    await clientShots(browser, w, kavya, sundara);
    await adminShots(browser, w, kavya, sundara);
  }
  await browser.close();
  await query("UPDATE Intake SET sectionsDone = ? WHERE clientId = ?", [JSON.stringify(kavyaDone[0]?.sectionsDone ?? []), kavya.clientId]);
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  await closeDb();
  console.log(`done, ${failures.length} failure(s)`);
  for (const f of failures) console.log("  " + f);
}
main().catch((e) => { console.error(e); process.exit(1); });
