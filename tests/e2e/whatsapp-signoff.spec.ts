import { expect, test } from "@playwright/test";
import { closeDb, query, resetRateLimits, SEED_SLUG, setPhase } from "./fixtures";

/**
 * PORTAL-SPEC 5.11 and acceptance criterion 6. A client who replies on
 * WhatsApp has agreed; the record says so, keeps what they wrote, and stays
 * distinguishable from a tap forever.
 */
const EMAIL = "e2e-wa@example.invalid";
const PASSWORD = "a-long-enough-passphrase";

let projectId = "";

test.afterAll(async () => {
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await closeDb();
});

async function signIn(page: import("@playwright/test").Page) {
  const { hash } = await import("bcryptjs");
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
    `e2ewa${Date.now()}`, EMAIL, "WhatsApp", await hash(PASSWORD, 12),
  ]);
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /^projects$/i })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await resetRateLimits();
  const rows = await query<{ id: string }>("SELECT id FROM Project WHERE slug = ?", [SEED_SLUG]);
  projectId = rows[0].id;
  await query("DELETE FROM Invoice WHERE projectId = ?", [projectId]);
  await query("DELETE FROM SignoffEvent WHERE projectId = ?", [projectId]);
  await query("UPDATE Agreement SET agreedAt = NULL, agreedByName = NULL, agreedMethod = NULL, sentAt = NOW() WHERE projectId = ?", [projectId]);
  await setPhase(projectId, "AGREEMENT_SENT");
  await signIn(page);
});

test("recording a WhatsApp yes agrees the project and raises the same advance", async ({ page }) => {
  await page.goto(`/admin/projects/${projectId}`);
  await page.getByText(/they agreed on whatsapp instead/i).click();

  await page.getByLabel(/who said it/i).fill("Arjun Sundaram");
  await page.getByLabel(/the day they said it/i).fill("2026-09-02");
  await page.getByLabel(/paste what they sent/i).fill("ok done, go ahead. send the invoice to accounts");
  await page.getByRole("button", { name: /record their yes/i }).click();

  await expect(page.getByText(/recorded from whatsapp/i)).toBeVisible();
  await expect(page.getByText(/ok done, go ahead/i)).toBeVisible();

  const events = await query<{ kind: string; method: string; actorName: string; rawNote: string; ip: string | null }>(
    "SELECT kind, method, actorName, rawNote, ip FROM SignoffEvent WHERE projectId = ?",
    [projectId],
  );
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ kind: "AGREEMENT", method: "WHATSAPP", actorName: "Arjun Sundaram" });
  expect(events[0].rawNote).toContain("ok done");
  expect(events[0].ip).toBeNull();

  // The same money follows, from the same rule.
  const invoices = await query<{ kind: string; totalPaise: string }>("SELECT kind, totalPaise FROM Invoice WHERE projectId = ?", [projectId]);
  expect(invoices).toHaveLength(1);
  expect(invoices[0].kind).toBe("ADVANCE");
  expect(BigInt(invoices[0].totalPaise as never)).toBe(26000000n);

  const phase = await query<{ phase: string; agreedMethod: string }>(
    "SELECT p.phase, a.agreedMethod FROM Project p JOIN Agreement a ON a.projectId = p.id WHERE p.id = ?",
    [projectId],
  );
  expect(phase[0]).toMatchObject({ phase: "AGREED", agreedMethod: "WHATSAPP" });
});

test("it refuses a date in the future and one before the project existed", async ({ page }) => {
  await page.goto(`/admin/projects/${projectId}`);
  await page.getByText(/they agreed on whatsapp instead/i).click();
  await page.getByLabel(/who said it/i).fill("Arjun Sundaram");
  await page.getByLabel(/paste what they sent/i).fill("ok done");

  await page.getByLabel(/the day they said it/i).fill("2020-01-01");
  await page.getByRole("button", { name: /record their yes/i }).click();
  await expect(page.getByText(/before the project existed/i)).toBeVisible();

  const events = await query("SELECT id FROM SignoffEvent WHERE projectId = ?", [projectId]);
  expect(events).toHaveLength(0);
});

test("it cannot be recorded twice, and the block is gone once agreed", async ({ page }) => {
  await page.goto(`/admin/projects/${projectId}`);
  await page.getByText(/they agreed on whatsapp instead/i).click();
  await page.getByLabel(/who said it/i).fill("Arjun Sundaram");
  await page.getByLabel(/the day they said it/i).fill("2026-09-02");
  await page.getByLabel(/paste what they sent/i).fill("ok done");
  await page.getByRole("button", { name: /record their yes/i }).click();
  await expect(page.getByText(/recorded from whatsapp/i)).toBeVisible();

  // The phase moved on, so the fallback is no longer offered.
  await expect(page.getByText(/they agreed on whatsapp instead/i)).toHaveCount(0);

  const invoices = await query("SELECT id FROM Invoice WHERE projectId = ?", [projectId]);
  expect(invoices).toHaveLength(1);
});
