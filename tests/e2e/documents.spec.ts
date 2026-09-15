import { expect, test, type Page } from "@playwright/test";
import { closeDb, freshLink, query, resetRateLimits, SEED_SLUG, takeoverLatestCode } from "./fixtures";

/**
 * ADR 0025. Your files: the client sends a file from their page and the team
 * sees it on the client's page; the team adds one and the client is told and
 * finds it in the same list; either side can take one away.
 */
const ADMIN_EMAIL = "e2e-docs@example.invalid";
const PASSWORD = "a-long-enough-passphrase";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

let projectId = "";
let clientId = "";
let token = "";

async function signInAdmin(page: Page) {
  const { hash } = await import("bcryptjs");
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
    `e2edoc${Date.now()}`, ADMIN_EMAIL, "Docs test", await hash(PASSWORD, 12),
  ]);
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /^projects$/i })).toBeVisible();
}

async function signInClient(page: Page) {
  await page.goto(`/p/${token}`);
  await page.getByRole("button", { name: /email me a code/i }).click();
  await expect(page.getByLabel(/six digit code/i)).toBeVisible();
  await page.getByLabel(/six digit code/i).fill(await takeoverLatestCode(projectId, "LOGIN"));
  await page.getByRole("button", { name: /open my page/i }).click();
  await expect(page.getByRole("main").getByText("Your project", { exact: true })).toBeVisible();
}

test.beforeEach(async () => {
  await resetRateLimits();
  const link = await freshLink(SEED_SLUG);
  projectId = link.projectId;
  clientId = link.clientId;
  token = link.token;
  await query("DELETE FROM ClientDocument WHERE clientId = ?", [clientId]);
});

test.afterAll(async () => {
  await query("DELETE FROM ClientDocument WHERE clientId = ?", [clientId]);
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  await closeDb();
});

test("a client sends a file from Your files, and the team sees and opens it", async ({ page, context }) => {
  await signInClient(page);
  await page.getByRole("button", { name: /^menu$/i }).click();
  await page.getByRole("link", { name: /your files/i }).click();
  await expect(page.getByRole("heading", { name: /anything you want us to have/i })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await page.getByLabel(/a line about them/i).fill("Our current logo.");
  await page.getByRole("button", { name: /send the files/i }).click();
  await expect(page.getByText(/file sent\. we have it/i)).toBeVisible();
  await expect(page.getByText("logo.png")).toBeVisible();
  await expect(page.getByText(/from you/i)).toBeVisible();
  await expect(page.getByText("Our current logo.")).toBeVisible();

  // The team sees it on the client's page and can open it; a stranger cannot.
  const admin = await context.newPage();
  await signInAdmin(admin);
  await admin.goto(`/admin/clients/${clientId}`);
  const card = admin.locator(".a-card", { hasText: /^files/i }).first();
  await expect(card.getByText("logo.png")).toBeVisible();
  await expect(card.getByText(/from /i).first()).toBeVisible();
  const href = await card.getByRole("link", { name: /logo\.png/i }).getAttribute("href");
  const opened = await admin.request.get(href!);
  expect(opened.status()).toBe(200);
  expect(opened.headers()["content-type"]).toContain("image/png");
  const stranger = await (await context.browser()!.newContext()).request.get(href!);
  expect(stranger.status()).toBe(404);
  await admin.close();
});

test("the team adds a file, the client is told, and the client can take it away", async ({ page, context }) => {
  const admin = await context.newPage();
  await signInAdmin(admin);
  await admin.goto(`/admin/clients/${clientId}`);
  const card = admin.locator(".a-card", { hasText: /^files/i }).first();
  await card.locator('input[type="file"]').setInputFiles({ name: "mockup.png", mimeType: "image/png", buffer: PNG });
  await card.getByLabel(/a line to .* about them/i).fill("First look at the home page.");
  await card.getByRole("button", { name: /add files for/i }).click();
  await expect(admin.getByText(/file added\./i)).toBeVisible();
  await admin.close();

  await signInClient(page);
  // Told: the bell carries it and it is under Your files.
  await page.getByRole("button", { name: /notifications, \d+ new/i }).click();
  // The suite's database keeps earlier runs' notices too, so the first is the one.
  await expect(page.locator("#notify-panel").getByText(/we added a file for you/i).first()).toBeVisible();
  await page.goto(`/p/${token}/files`);
  await expect(page.getByText("mockup.png")).toBeVisible();
  await expect(page.getByText(/from awtm forge/i)).toBeVisible();
  await expect(page.getByText("First look at the home page.")).toBeVisible();

  await page.getByRole("button", { name: /^remove$/i }).first().click();
  await expect(page.getByText(/^removed\.$/i)).toBeVisible();
  await expect(page.getByText("mockup.png")).toHaveCount(0);
  const rows = await query<{ n: number }>("SELECT COUNT(*) AS n FROM ClientDocument WHERE clientId = ?", [clientId]);
  expect(Number(rows[0].n)).toBe(0);
});
