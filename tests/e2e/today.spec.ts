import { expect, test } from "@playwright/test";
import { closeDb, query, resetRateLimits } from "./fixtures";

/**
 * The team's shared Today list: add an item, tick it, remove it. The spec
 * names its own item and clears it, so the seed data is left as found.
 */
const EMAIL = "e2e-today@example.invalid";
const PASSWORD = "a-long-enough-passphrase";
const ITEM = `e2e today item ${Date.now()}`;

test.afterAll(async () => {
  await query("DELETE FROM Todo WHERE text LIKE 'e2e today item %'");
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await closeDb();
});

async function signInAdmin(page: import("@playwright/test").Page) {
  const { hash } = await import("bcryptjs");
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
    `e2etoday${Date.now()}`, EMAIL, "Today", await hash(PASSWORD, 12),
  ]);
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /^projects$/i })).toBeVisible();
}

test.beforeEach(async () => {
  await resetRateLimits();
  await query("DELETE FROM Todo WHERE text LIKE 'e2e today item %'");
});

test("an item is added, ticked and removed", async ({ page }) => {
  await signInAdmin(page);
  await page.getByRole("link", { name: /^today$/i }).click();
  await expect(page.getByRole("heading", { name: /^today$/i })).toBeVisible();

  await page.getByLabel(/new item/i).fill(ITEM);
  await page.getByRole("button", { name: /^add$/i }).click();
  const box = page.getByRole("checkbox", { name: ITEM });
  await expect(box).toBeVisible();
  await expect(box).toHaveAttribute("aria-checked", "false");

  await box.click();
  await expect(page.getByRole("checkbox", { name: ITEM })).toHaveAttribute("aria-checked", "true");
  const rows = await query<{ doneAt: Date | null }>("SELECT doneAt FROM Todo WHERE text = ?", [ITEM]);
  expect(rows[0]?.doneAt).not.toBeNull();

  await page.getByRole("button", { name: `Remove ${ITEM}` }).click();
  await expect(page.getByText(/^removed\.$/i)).toBeVisible();
  await expect(page.getByRole("checkbox", { name: ITEM })).toHaveCount(0);
  expect(await query("SELECT id FROM Todo WHERE text = ?", [ITEM])).toHaveLength(0);
});
