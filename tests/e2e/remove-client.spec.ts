import { expect, test, type Page } from "@playwright/test";
import { closeDb, freshLink, query, resetRateLimits, SEED_SLUG } from "./fixtures";

/**
 * Removing a client for good (ADR 0022, Ayush 15 Sep). It needs the name
 * typed, a reason, and the admin's own password; it is refused once anything
 * of theirs is evidence; and afterwards nothing of theirs answers.
 */
const ADMIN_EMAIL = "e2e-remove@example.invalid";
const PASSWORD = "a-long-enough-passphrase";

async function signInAdmin(page: Page) {
  const { hash } = await import("bcryptjs");
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
    `e2erm${Date.now()}`, ADMIN_EMAIL, "Remove test", await hash(PASSWORD, 12),
  ]);
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /^projects$/i })).toBeVisible();
}

test.beforeEach(async () => {
  await resetRateLimits();
});

test.afterAll(async () => {
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  await closeDb();
});

test("a client nothing has happened to can be removed, with the name, a reason and the password", async ({ page }) => {
  await signInAdmin(page);

  // Made through the app, the way a real one is.
  await page.goto("/admin/clients");
  await page.getByRole("link", { name: /add a client/i }).click();
  const stamp = Date.now();
  const business = `Gone Soon ${stamp}`;
  await page.getByLabel(/business name/i).fill(business);
  await page.getByLabel(/^name$/i).fill("Asha Rao");
  await page.getByLabel(/whatsapp number/i).fill("+91 90000 22222");
  await page.getByLabel(/^email$/i).fill(`gone${stamp}@example.invalid`);
  await page.getByRole("button", { name: /show me their link/i }).click();
  await expect(page.getByRole("heading", { name: /send asha their link/i })).toBeVisible();
  const link = (await page.locator(".a-fld.mono").first().innerText()).trim();
  const token = link.split("/p/")[1];
  const clientId = page.url().match(/\/admin\/clients\/([^/]+)\/link/)?.[1];
  if (!clientId) throw new Error("no client id in the url");

  await page.goto(`/admin/clients/${clientId}`);
  await page.getByRole("button", { name: /remove this client/i }).click();

  // The wrong password removes nothing and says so.
  await page.getByLabel(/their business name, typed/i).fill(business);
  await page.getByLabel(/why, in a line/i).fill("added to try the flow");
  await page.getByLabel(/your password/i).fill("not-the-password");
  await page.getByRole("button", { name: /remove them for good/i }).click();
  await expect(page.getByText(/not removed: that is not your password/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: business })).toBeVisible();

  // The wrong name, with the right password, removes nothing either.
  await page.getByRole("button", { name: /remove this client/i }).click();
  await page.getByLabel(/their business name, typed/i).fill("Some Other Business");
  await page.getByLabel(/why, in a line/i).fill("added to try the flow");
  await page.getByLabel(/your password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /remove them for good/i }).click();
  await expect(page.getByText(/not removed: the name you typed does not match/i)).toBeVisible();

  // All three right: gone, and the log says so.
  await page.getByRole("button", { name: /remove this client/i }).click();
  await page.getByLabel(/their business name, typed/i).fill(business);
  await page.getByLabel(/why, in a line/i).fill("added to try the flow");
  await page.getByLabel(/your password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /remove them for good/i }).click();
  await expect(page).toHaveURL(/\/admin\/clients$/);
  await expect(page.getByText(new RegExp(`removed ${business}`, "i"))).toBeVisible();

  // Nothing of theirs answers any more.
  expect((await page.goto(`/admin/clients/${clientId}`))?.status()).toBe(404);
  expect((await page.goto(`/p/${token}`))?.status()).toBe(404);
  const rows = await query<{ n: number }>("SELECT COUNT(*) AS n FROM Client WHERE id = ?", [clientId]);
  expect(Number(rows[0].n)).toBe(0);
  // The driver hands a JSON column back parsed, so it is stringified to search.
  const trace = await query<{ payload: unknown }>("SELECT payload FROM ActivityEvent WHERE type = 'client.removed' ORDER BY createdAt DESC LIMIT 1");
  const survived = JSON.stringify(trace[0].payload);
  expect(survived).toContain(business);
  expect(survived).not.toContain(`gone${stamp}@example.invalid`);
});

test("a client with a sign-off cannot be removed, and the page says why instead of offering", async ({ page }) => {
  // The suite resets the seed project's evidence between tests, so this one
  // plants a sign-off of its own and takes it away again, the way the
  // fixtures do, rather than trusting what another test left.
  const { clientId, projectId } = await freshLink(SEED_SLUG);
  const evidence = `e2erm-signoff-${Date.now()}`;
  await query("INSERT INTO SignoffEvent (id, projectId, kind, method, actorName) VALUES (?, ?, 'AGREEMENT', 'PORTAL', 'E2E')", [evidence, projectId]);
  try {
    await signInAdmin(page);
    await page.goto(`/admin/clients/${clientId}`);
    await expect(page.getByText(/cannot be removed:/i)).toBeVisible();
    await expect(page.getByText(/sign-off was recorded|sign-offs were recorded/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /remove this client/i })).toHaveCount(0);
  } finally {
    await query("DELETE FROM SignoffEvent WHERE id = ?", [evidence]);
  }
});
