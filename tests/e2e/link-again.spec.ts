import { expect, test, type Page } from "@playwright/test";
import { closeDb, freshLink, query, SEED_SLUG } from "./fixtures";

/**
 * The team can send a client their link a second time without taking away the
 * one they already have (ADR 0021, Ayush 14 Sep).
 *
 * And adding an admin is a control on the settings page rather than a folded
 * grey line, with the three steps of what happens next beside it.
 *
 * A link minted before the sealed copy existed is not lost to that page for
 * good: it is kept the first time the client opens it, and the team can paste
 * it from their sent mail to keep it now (Ayush, 15 Sep).
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

test("a link minted before the copy existed is kept the first time the client opens it", async ({ page }) => {
  // The fixture mints a hash with no copy, the shape of every link from
  // before 14 September.
  const { token, clientId } = await freshLink(SEED_SLUG);
  await signInAdmin(page);
  await page.goto(`/admin/clients/${clientId}/link`);
  await expect(page.getByText(/we do not hold this link/i)).toBeVisible();
  await expect(page.locator(".a-fld.mono")).toHaveCount(1);

  // The client opens their link. No code, no sign-in: the visit alone is
  // enough, because the plain token arrives in that request.
  await page.goto(`/p/${token}`);
  await expect(page.getByRole("button", { name: /email me a code/i })).toBeVisible();

  await page.goto(`/admin/clients/${clientId}/link`);
  const shown = (await page.locator(".a-fld.mono").first().innerText()).trim();
  expect(shown, "the same link the client holds").toMatch(new RegExp(`/p/${token}$`));
  await expect(page.getByText(/this page can show it again/i)).toBeVisible();
});

test("the team can paste an old link from their sent mail, and only the right one is kept", async ({ page }) => {
  const { token, clientId } = await freshLink(SEED_SLUG);
  await signInAdmin(page);
  await page.goto(`/admin/clients/${clientId}/link`);
  await expect(page.getByText(/we do not hold this link/i)).toBeVisible();

  // Somebody else's link, or a typo: checked against the hash, kept nothing.
  await page.getByLabel(/their link, pasted/i).fill("https://dashboard.awtmforge.com/p/not_their_token_at_all_but_long_enough_to_pass");
  await page.getByRole("button", { name: /keep this link/i }).click();
  await expect(page.getByText(/not kept: that is not their link/i)).toBeVisible();
  await expect(page.getByText(/we do not hold this link/i)).toBeVisible();

  // The real one, pasted as it sits in the sent mail, with the query string
  // the mail client added.
  await page.getByLabel(/their link, pasted/i).fill(`https://dashboard.awtmforge.com/p/${token}?utm_source=mail `);
  await page.getByRole("button", { name: /keep this link/i }).click();
  await expect(page.getByText(/kept\. this page can show their link/i)).toBeVisible();
  const shown = (await page.locator(".a-fld.mono").first().innerText()).trim();
  expect(shown).toMatch(new RegExp(`/p/${token}$`));
  await expect(page.getByRole("button", { name: /keep this link/i })).toHaveCount(0);
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
