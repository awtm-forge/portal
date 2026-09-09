import { expect, test } from "@playwright/test";
import { closeDb, freshLink, INTAKE_SLUG, query, resetRateLimits, SEED_SLUG } from "./fixtures";

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

test("a client is added, gets their link at once, and it cannot be recovered later", async ({ page }) => {
  await page.goto("/admin/clients");
  await page.getByRole("link", { name: /add a client/i }).click();

  await page.getByLabel(/business name/i).fill(BUSINESS);
  await page.getByLabel(/where they are/i).fill("Pune");
  await page.getByLabel(/^name$/i).fill("Meher Shah");
  await page.getByLabel(/whatsapp number/i).fill("+91 99000 21188");
  await page.getByLabel(/^email$/i).fill("meher@example.invalid");
  await page.getByRole("button", { name: /save, and show me their link/i }).click();

  // Straight to the handover, with the link in the clear. No project exists.
  await expect(page.getByRole("heading", { name: /send meher their link/i })).toBeVisible();
  const shown = page.getByText(/\/p\/[A-Za-z0-9_-]{20,}/).first();
  await expect(shown).toBeVisible();
  const link = (await shown.textContent()) ?? "";
  expect(link).toMatch(/\/p\/[A-Za-z0-9_-]{20,}/);

  // Q12: nothing has gone out and nothing has been started. The link belongs
  // to the client, and the email waits for the questionnaire.
  const rows = await query<{ linkEmailedAt: string | null; projects: number }>(
    "SELECT c.linkEmailedAt, (SELECT COUNT(*) FROM Project p WHERE p.clientId = c.id) AS projects FROM Client c WHERE c.businessName = ?",
    [BUSINESS],
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].linkEmailedAt).toBeNull();
  expect(Number(rows[0].projects)).toBe(0);

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
  await page.getByRole("button", { name: /save, and show me their link/i }).click();
  await expect(page.getByRole("heading", { name: /send meher their link/i })).toBeVisible();

  const [c] = await query<{ id: string }>("SELECT id FROM Client WHERE businessName = ?", [BUSINESS]);
  await page.goto(`/admin/clients/${c.id}/projects/new`);
  await page.getByLabel(/project name/i).fill("Brand and packaging");
  await page.getByRole("checkbox", { name: /same as meher shah/i }).uncheck();
  await page.getByLabel(/^name$/i).fill("Devika Rao");
  await page.getByLabel(/their email/i).fill("devika@example.invalid");
  await page.getByRole("button", { name: /start the project/i }).click();
  await page.waitForURL(/\/admin\/projects\//);

  const rows = await query<{ signoffPersonName: string; signoffPersonEmail: string }>(
    "SELECT p.signoffPersonName, p.signoffPersonEmail FROM Project p JOIN Client c ON c.id = p.clientId WHERE c.businessName = ?",
    [BUSINESS],
  );
  expect(rows[0]).toMatchObject({ signoffPersonName: "Devika Rao", signoffPersonEmail: "devika@example.invalid" });
});

test("a client with no project is offered the questionnaire first, and a project second", async ({ page }) => {
  await page.goto("/admin/clients/new");
  await page.getByLabel(/business name/i).fill(BUSINESS);
  await page.getByLabel(/^name$/i).fill("Meher Shah");
  await page.getByLabel(/whatsapp number/i).fill("+91 99000 21188");
  await page.getByLabel(/^email$/i).fill("meher@example.invalid");
  await page.getByRole("button", { name: /save, and show me their link/i }).click();
  await expect(page.getByRole("heading", { name: /send meher their link/i })).toBeVisible();

  const [c] = await query<{ id: string }>("SELECT id FROM Client WHERE businessName = ?", [BUSINESS]);
  await page.goto(`/admin/clients/${c.id}`);
  await expect(page.getByRole("heading", { name: BUSINESS })).toBeVisible();
  // Q12: the loud thing is the questionnaire, not a project.
  await expect(page.getByRole("link", { name: /send the questionnaire/i })).toBeVisible();
  await expect(page.getByText(/send the questionnaire first; the project comes after/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /start a project/i })).toBeVisible();
  await expect(page.getByText(/no password exists/i)).toBeVisible();
});

test("rotating the link kills the old one on the next request", async ({ request }) => {
  // Acceptance criterion 9. Rotation is what you reach for when a link went to
  // the wrong person, so the old one has to stop working, not merely stop
  // being advertised.
  const first = await freshLink(SEED_SLUG);
  expect((await request.get(`/p/${first.token}`, { maxRedirects: 0 })).status()).toBe(200);

  const second = await freshLink(SEED_SLUG);
  expect(second.token).not.toBe(first.token);
  expect((await request.get(`/p/${first.token}`, { maxRedirects: 0 })).status()).toBe(404);
  expect((await request.get(`/p/${second.token}`, { maxRedirects: 0 })).status()).toBe(200);
});

test("an uploaded file cannot be reached by guessing its address", async ({ request }) => {
  // INTAKE-SPEC 14.6. The id is a cuid, so guessing one is not the threat; the
  // threat is a real id reaching someone who has no session for that project.
  const { token, clientId } = await freshLink(SEED_SLUG);
  const rows = await query<{ id: string }>("SELECT id FROM IntakeFile WHERE clientId = ? LIMIT 1", [clientId]);
  const fileId = rows[0]?.id ?? "cmtsq9anb005mpvs4w4avnux6";

  // No session at all.
  expect((await request.get(`/p/${token}/file/${fileId}`, { maxRedirects: 0 })).status()).toBe(404);
  // A real id under someone else's token, which is the case that matters.
  const other = await freshLink(INTAKE_SLUG);
  expect((await request.get(`/p/${other.token}/file/${fileId}`, { maxRedirects: 0 })).status()).toBe(404);
  // And the admin route is no easier without a session.
  expect((await request.get(`/admin/clients/${clientId}/file/${fileId}`, { maxRedirects: 0 })).status()).not.toBe(200);
});
