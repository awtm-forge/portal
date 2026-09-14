import { expect, test, type Page } from "@playwright/test";
import { closeDb, query } from "./fixtures";

/**
 * The team can send a client their link a second time without taking away the
 * one they already have (ADR 0021, Ayush 14 Sep).
 *
 * And adding an admin is a control on the settings page rather than a folded
 * grey line, with the three steps of what happens next beside it.
 */
const ADMIN_EMAIL = "e2e-link@example.invalid";
const PASSWORD = "a-long-enough-passphrase";

async function signInAdmin(page: Page) {
  const { hash } = await import("bcryptjs");
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
    `e2elink${Date.now()}`, ADMIN_EMAIL, "Link test", await hash(PASSWORD, 12),
  ]);
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /^projects$/i })).toBeVisible();
}

test.afterAll(async () => {
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  await closeDb();
});

test("a client's link can be read back and sent again, and it still works", async ({ page, context }) => {
  await signInAdmin(page);

  // A client made through the app, so its link is sealed the way a real one is.
  await page.goto("/admin/clients");
  await page.getByRole("link", { name: /add a client/i }).click();
  const stamp = Date.now();
  await page.getByLabel(/business name/i).fill(`Sealed Test ${stamp}`);
  await page.getByLabel(/^name$/i).fill("Asha Rao");
  await page.getByLabel(/whatsapp number/i).fill("+91 90000 11111");
  await page.getByLabel(/^email$/i).fill(`sealed${stamp}@example.invalid`);
  await page.getByRole("button", { name: /show me their link/i }).click();

  // The handover screen, with the link on it.
  await expect(page.getByRole("heading", { name: /send asha their link/i })).toBeVisible();
  const shownOnce = (await page.locator(".a-fld.mono").first().innerText()).trim();
  expect(shownOnce, "the link is a real one").toMatch(/\/p\/[\w-]{20,}$/);

  // Come back later, with the flash cookie long gone: the same link is here.
  const linkPage = page.url();
  await context.clearCookies({ name: "awtm_link" });
  await page.goto("/admin");
  await page.goto(linkPage);
  const shownAgain = (await page.locator(".a-fld.mono").first().innerText()).trim();
  expect(shownAgain, "the same link, not a new one").toBe(shownOnce);
  await expect(page.getByText(/this page can show it again/i)).toBeVisible();

  // And it is the link that actually works: the client's page opens on it.
  const token = shownOnce.split("/p/")[1];
  const client = await context.newPage();
  await client.goto(`/p/${token}`);
  await expect(client.getByRole("button", { name: /email me a code/i })).toBeVisible();
  await client.close();

  await query("DELETE FROM Client WHERE contactEmail = ?", [`sealed${stamp}@example.invalid`]);
});

test("adding an admin is a control on the page, with the flow beside it", async ({ page }) => {
  await signInAdmin(page);
  await page.goto("/admin/settings");

  // Not folded away behind a grey line: the form is on the page.
  await expect(page.getByRole("textbox", { name: /email/i }).last()).toBeVisible();
  await expect(page.getByRole("button", { name: /add an admin|reissue a setup link/i })).toBeVisible();

  // The three steps, so nobody has to guess that we never set a password.
  const steps = page.locator(".a-steps li");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(2)).toContainText(/choose a password/i);
  await expect(page.getByText(/never set anyone's password|reissues its setup link/i).first()).toBeVisible();
});
