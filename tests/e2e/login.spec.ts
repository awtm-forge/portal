import { expect, test } from "@playwright/test";
import { closeDb, freshLink, query, resetRateLimits, SEED_SLUG, takeoverLatestCode } from "./fixtures";

/**
 * Q18: the link is no longer the only way in. A client who lost it logs in
 * with the email they gave us and lands on their page at /p/me, resolved from
 * the session rather than a token in the URL.
 */
test.afterAll(async () => { await closeDb(); });

test("a bad link offers a login, not a dead end", async ({ page }) => {
  await page.goto("/p/nosuchtokenatall");
  await expect(page.getByText(/We cannot find that page/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Log in with your email/i })).toBeVisible();
});

test("logging in with the email lands on the page at /p/me", async ({ page }) => {
  const link = await freshLink(SEED_SLUG);
  const email = (await query<{ contactEmail: string }>("SELECT contactEmail FROM Client WHERE id = ?", [link.clientId]))[0].contactEmail;
  await resetRateLimits();

  await page.goto("/p/login");
  await page.getByLabel(/Your email/i).fill(email);
  await page.getByRole("button", { name: /email me a code/i }).click();
  await expect(page.getByLabel(/six digit code/i)).toBeVisible();
  await page.getByLabel(/six digit code/i).fill(await takeoverLatestCode(link.projectId, "LOGIN"));
  await page.getByRole("button", { name: /^Log in$/ }).click();

  await page.waitForURL(/\/p\/me$/);
  await expect(page.getByText("Your project", { exact: true })).toBeVisible();
  // The menu on the tokenless page points at /p/me, not a token.
  await page.getByRole("button", { name: /menu/i }).click();
  await expect(page.getByRole("navigation", { name: "Your pages" }).getByRole("link", { name: "Your page" })).toHaveAttribute("href", "/p/me");
});

test("the tokenless page sends a signed-out visitor to the login", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/p/me");
  await expect(page).toHaveURL(/\/p\/login$/);
  await expect(page.getByRole("heading", { name: /Lost your link/i })).toBeVisible();
});
