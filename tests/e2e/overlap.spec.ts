import { expect, test, type Page } from "@playwright/test";
import { PROBE, type Finding } from "../../scripts/ux-audit/probe";
import { backToBuilding, closeDb, freshLink, INTAKE_SLUG, query, resetRateLimits, SEED_SLUG, takeoverLatestCode } from "./fixtures";

/**
 * No text sits on top of other text, and none spills out of the box that holds
 * it, on the screens a client and the team actually use.
 *
 * Written 14 Sep after a stage label in the client rail overlapped the next
 * one, and after the wider sweep that found two more: the image library's
 * captions running into the next cell beside a 330 px aside, and the admin's
 * nav squeezed to 85 px of a 390 px bar.
 *
 * The same probe runs over every screen at six widths in both themes in
 * scripts/ux-audit/overlap.ts, which is too slow for this suite. This is the
 * fast half: the screens that matter most, at the two widths the suite already
 * runs, so a regression is caught by the gate rather than by a person.
 */
const ADMIN_EMAIL = "e2e-overlap@example.invalid";
const PASSWORD = "a-long-enough-passphrase";

async function signInAdmin(page: Page) {
  const { hash } = await import("bcryptjs");
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
    `e2eov${Date.now()}`, ADMIN_EMAIL, "Overlap", await hash(PASSWORD, 12),
  ]);
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /^projects$/i })).toBeVisible();
}

async function signInClient(page: Page, token: string, projectId: string) {
  await resetRateLimits();
  await page.goto(`/p/${token}`);
  await page.getByRole("button", { name: /email me a code/i }).click();
  // Wait for the box before reading the code: the click is what issues it.
  await expect(page.getByLabel(/six digit code/i)).toBeVisible();
  await page.getByLabel(/six digit code/i).fill(await takeoverLatestCode(projectId, "LOGIN"));
  await page.getByRole("button", { name: /open my page/i }).click();
  await expect(page.getByRole("button", { name: /menu/i })).toBeVisible();
}

async function clean(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const findings = (await page.evaluate(PROBE)) as Finding[];
  const said = findings.map((f) => `${f.kind} ${f.by}px: ${f.what}`);
  expect(said, `${path}\n${said.join("\n")}`).toEqual([]);
}

test.afterAll(async () => {
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  await closeDb();
});

test("nothing overlaps on the client's screens", async ({ page }) => {
  const seed = await freshLink(SEED_SLUG);
  await backToBuilding(seed.projectId);
  await signInClient(page, seed.token, seed.projectId);

  for (const path of [
    `/p/${seed.token}`,
    `/p/${seed.token}/agreement`,
    `/p/${seed.token}/invoices`,
    `/p/${seed.token}/updates`,
    "/p/login",
    "/",
  ]) {
    await clean(page, path);
  }

  // The client whose questionnaire is still open, which is where the rail
  // carries its longest label as the current stage.
  const open = await freshLink(INTAKE_SLUG);
  await signInClient(page, open.token, open.projectId);
  await clean(page, `/p/${open.token}`);
  await clean(page, `/p/${open.token}/intake`);
});

test("nothing overlaps on the team's screens", async ({ page }) => {
  const seed = await freshLink(SEED_SLUG);
  await backToBuilding(seed.projectId);
  await signInAdmin(page);

  for (const path of [
    "/admin",
    `/admin/projects/${seed.projectId}`,
    `/admin/clients/${seed.clientId}`,
    "/admin/notifications",
    "/admin/library",
    "/admin/settings",
  ]) {
    await clean(page, path);
  }
});
