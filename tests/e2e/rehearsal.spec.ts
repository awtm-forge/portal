import { expect, test, type Page } from "@playwright/test";
import { closeDb, query, resetRateLimits } from "./fixtures";

/**
 * ADR 0023. In rehearsal the settings page offers the clean start and the
 * switch to live, both behind the password. The wipe itself is not run here,
 * because the suite's own fixtures would go with it; the unit test tries it
 * inside a rolled-back transaction. What this walks is the gate and the
 * switch.
 */
const ADMIN_EMAIL = "e2e-rehearsal@example.invalid";
const PASSWORD = "a-long-enough-passphrase";

async function signInAdmin(page: Page) {
  const { hash } = await import("bcryptjs");
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
    `e2ereh${Date.now()}`, ADMIN_EMAIL, "Rehearsal test", await hash(PASSWORD, 12),
  ]);
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /^projects$/i })).toBeVisible();
}

test.beforeEach(async () => {
  await resetRateLimits();
  await query("DELETE FROM Setting WHERE `key` = 'live_since'");
});

test.afterAll(async () => {
  await query("DELETE FROM Setting WHERE `key` = 'live_since'");
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  await closeDb();
});

test("in rehearsal the clean start and the switch to live are on the settings page, behind the password", async ({ page }) => {
  await signInAdmin(page);
  await page.goto("/admin/settings");
  await expect(page.getByText(/counts as rehearsal/i)).toBeVisible();

  // The wrong password erases nothing and says so.
  await page.getByRole("button", { name: /^start clean$/i }).click();
  await page.getByLabel(/type .erase every client/i).fill("erase every client");
  await page.getByLabel(/why, in a line/i).fill("trying the gate");
  await page.getByLabel(/your password/i).first().fill("not-the-password");
  await page.getByRole("button", { name: /^erase every client$/i }).click();
  await expect(page.getByText(/not started clean: that is not your password/i)).toBeVisible();
  const clients = await query<{ n: number }>("SELECT COUNT(*) AS n FROM Client");
  expect(Number(clients[0].n), "everything is still there").toBeGreaterThan(0);

  // The switch, with the right password: one way, and Start clean is gone.
  await page.getByRole("button", { name: /mark the portal live/i }).click();
  await page.getByLabel(/your password/i).last().fill(PASSWORD);
  await page.getByRole("button", { name: /^it is live$/i }).click();
  await expect(page.getByText(/the portal is live\. from now on/i)).toBeVisible();
  await expect(page.getByText(/live since/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /^start clean$/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /mark the portal live/i })).toHaveCount(0);

  // And the health check says so, true or false, never a date.
  const health = await (await page.request.get("/healthz")).json();
  expect(health.live).toBe(true);
});
