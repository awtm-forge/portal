import { expect, test } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { closeDb, query, resetRateLimits } from "./fixtures";

/**
 * PORTAL-SPEC 6.6 and CLAUDE.md section 4: two accounts, no self-registration,
 * and a password nobody generates but the person themselves.
 */
const EMAIL = "e2e-admin@example.invalid";

test.afterAll(async () => {
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await closeDb();
});

test.beforeEach(async () => {
  await resetRateLimits();
});

async function makeSetupLink(): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const expires = new Date(Date.now() + 3600_000);
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await query(
    "INSERT INTO AdminUser (id, email, name, passwordHash, setupTokenHash, setupExpiresAt, createdAt) VALUES (?, ?, ?, NULL, ?, ?, NOW(3))",
    [`e2e${Date.now()}`, EMAIL, "End to end", hash, expires],
  );
  return token;
}

test("an account with no password cannot be signed into until its link is used", async ({ page }) => {
  await makeSetupLink();
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill("anything-at-all-here");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByText(/that did not match/i)).toBeVisible();
});

test("the setup link lets the person choose their own password and signs them in", async ({ page }) => {
  const token = await makeSetupLink();
  await page.goto(`/admin/setup/${token}`);
  await expect(page.getByRole("heading", { name: /choose your password/i })).toBeVisible();

  // The browser refuses a short one before the server is asked.
  await page.getByLabel(/^password/i).fill("short");
  await page.getByLabel(/again/i).fill("short");
  await page.getByRole("button", { name: /set it and sign in/i }).click();
  await expect(page.getByRole("heading", { name: /choose your password/i })).toBeVisible();
  expect(await page.getByLabel(/^password/i).evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);

  await page.getByLabel(/^password/i).fill("a-long-enough-passphrase");
  await page.getByLabel(/again/i).fill("a-different-passphrase-x");
  await page.getByRole("button", { name: /set it and sign in/i }).click();
  await expect(page.getByText(/the two do not match/i)).toBeVisible();

  await page.getByLabel(/^password/i).fill("a-long-enough-passphrase");
  await page.getByLabel(/again/i).fill("a-long-enough-passphrase");
  await page.getByRole("button", { name: /set it and sign in/i }).click();

  await expect(page.getByRole("heading", { name: /^projects$/i })).toBeVisible();

  // The link works once.
  await page.goto(`/admin/setup/${token}`);
  await expect(page.getByRole("heading", { name: /choose your password/i })).toHaveCount(0);
});

test("admin routes send a browser to the login screen", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/admin/library");
  await expect(page.getByRole("heading", { name: /two accounts, no sign-up/i })).toBeVisible();
});
