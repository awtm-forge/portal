import { expect, test } from "@playwright/test";
import { closeDb, query, resetRateLimits } from "./fixtures";

/**
 * Onboarding a client and handing over the link. The rule under test is
 * PORTAL-SPEC 5.9: only a hash of the link is stored, so the handover screen
 * is the one and only place it can be shown.
 */
const EMAIL = "e2e-onboard@example.invalid";
const BUSINESS = "E2E Onboarding Co";
const PASSWORD = "a-long-enough-passphrase";

test.afterAll(async () => {
  await query("DELETE FROM Project WHERE slug LIKE 'e2e-onboarding-co%'");
  await query("DELETE FROM Client WHERE businessName = ?", [BUSINESS]);
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await closeDb();
});

async function signInAsAdmin(page: import("@playwright/test").Page) {
  const { hash } = await import("bcryptjs");
  const passwordHash = await hash(PASSWORD, 12);
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
    `e2eon${Date.now()}`,
    EMAIL,
    "Onboarding",
    passwordHash,
  ]);
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /^projects$/i })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await resetRateLimits();
  await query("DELETE FROM Project WHERE slug LIKE 'e2e-onboarding-co%'");
  await query("DELETE FROM Client WHERE businessName = ?", [BUSINESS]);
  await signInAsAdmin(page);
});

test("a client is added, gets a project, and the link cannot be recovered later", async ({ page }) => {
  await page.goto("/admin/clients");
  await page.getByRole("link", { name: /add a client/i }).click();

  await page.getByLabel(/business name/i).fill(BUSINESS);
  await page.getByLabel(/where they are/i).fill("Pune");
  await page.getByLabel(/^name$/i).fill("Meher Shah");
  await page.getByLabel(/whatsapp number/i).fill("+91 99000 21188");
  await page.getByLabel(/^email$/i).fill("meher@example.invalid");
  await page.getByRole("button", { name: /save, and start a project/i }).click();

  // Straight into the project form, with the client already chosen.
  await expect(page.getByRole("heading", { name: /start a project/i })).toBeVisible();
  await expect(page.getByText(BUSINESS, { exact: true })).toBeVisible();

  await page.getByLabel(/project name/i).fill("Brand and packaging");
  await page.getByRole("button", { name: /create it and show me the link/i }).click();

  // The handover screen, with the link in the clear.
  await expect(page.getByRole("heading", { name: /send meher their link/i })).toBeVisible();
  const shown = page.getByText(/\/p\/[A-Za-z0-9_-]{20,}/).first();
  await expect(shown).toBeVisible();
  const link = (await shown.textContent()) ?? "";
  expect(link).toMatch(/\/p\/[A-Za-z0-9_-]{20,}/);

  // The sign-off person defaulted to the contact, and the email went out.
  const rows = await query<{ signoffPersonEmail: string; linkEmailedAt: string | null }>(
    "SELECT p.signoffPersonEmail, p.linkEmailedAt FROM Project p JOIN Client c ON c.id = p.clientId WHERE c.businessName = ?",
    [BUSINESS],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].signoffPersonEmail).toBe("meher@example.invalid");
  expect(rows[0].linkEmailedAt).not.toBeNull();

  // A reload still shows it, on purpose: losing the link to a stray refresh
  // would be hostile, so it rides a fifteen minute cookie.
  await page.reload();
  await expect(page.getByText(link.trim(), { exact: true })).toBeVisible();

  // Once that cookie is gone, nothing can bring the link back, because only
  // its hash was ever stored (PORTAL-SPEC 5.9). This is the property that
  // matters, and it is why the handover has its own screen.
  await page.context().clearCookies({ name: "awtm_flash_link" });
  await page.reload();
  await expect(page.getByText(/the link is not in hand/i)).toBeVisible();
  await expect(page.getByText(link.trim(), { exact: true })).toHaveCount(0);
});

test("the sign-off person can differ from the day to day contact", async ({ page }) => {
  await page.goto("/admin/clients/new");
  await page.getByLabel(/business name/i).fill(BUSINESS);
  await page.getByLabel(/^name$/i).fill("Meher Shah");
  await page.getByLabel(/whatsapp number/i).fill("+91 99000 21188");
  await page.getByLabel(/^email$/i).fill("meher@example.invalid");
  await page.getByRole("button", { name: /save, and start a project/i }).click();

  await page.getByLabel(/project name/i).fill("Brand and packaging");
  await page.getByRole("checkbox", { name: /same as meher shah/i }).uncheck();
  await page.getByLabel(/^name$/i).fill("Devika Rao");
  await page.getByLabel(/their email/i).fill("devika@example.invalid");
  await page.getByRole("button", { name: /create it and show me the link/i }).click();

  await expect(page.getByRole("heading", { name: /send meher their link/i })).toBeVisible();
  const rows = await query<{ signoffPersonName: string; signoffPersonEmail: string }>(
    "SELECT p.signoffPersonName, p.signoffPersonEmail FROM Project p JOIN Client c ON c.id = p.clientId WHERE c.businessName = ?",
    [BUSINESS],
  );
  expect(rows[0]).toMatchObject({ signoffPersonName: "Devika Rao", signoffPersonEmail: "devika@example.invalid" });
});

test("a client with no project says so, and offers to start one", async ({ page }) => {
  await page.goto("/admin/clients/new");
  await page.getByLabel(/business name/i).fill(BUSINESS);
  await page.getByLabel(/^name$/i).fill("Meher Shah");
  await page.getByLabel(/whatsapp number/i).fill("+91 99000 21188");
  await page.getByLabel(/^email$/i).fill("meher@example.invalid");
  await page.getByRole("button", { name: /just save the client/i }).click();

  await expect(page.getByRole("heading", { name: BUSINESS })).toBeVisible();
  await expect(page.getByText(/no project yet/i).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /start a project/i })).toBeVisible();
  await expect(page.getByText(/no password exists/i)).toBeVisible();
});
