import { expect, test } from "@playwright/test";
import { closeDb, freshLink, query, resetRateLimits, SEED_SLUG, setPhase } from "./fixtures";

/**
 * PORTAL-SPEC 6.6 and CLAUDE.md 5. The needs-attention block, and the one
 * move that ends a project without a delivery.
 */
const EMAIL = "e2e-attention@example.invalid";
const PASSWORD = "a-long-enough-passphrase";

let projectId = "";

test.afterAll(async () => {
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await query("UPDATE Project SET cancelledAt = NULL, cancelReason = NULL WHERE id = ?", [projectId]);
  await query("DELETE FROM Invoice WHERE number = ?", ["ATN/26-27/001"]);
  await setPhase(projectId, "BUILDING");
  await closeDb();
});

async function signInAdmin(page: import("@playwright/test").Page) {
  const { hash } = await import("bcryptjs");
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
    `e2eatt${Date.now()}`, EMAIL, "Attention", await hash(PASSWORD, 12),
  ]);
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /^projects$/i })).toBeVisible();
}

test.beforeEach(async () => {
  await resetRateLimits();
  const link = await freshLink(SEED_SLUG);
  projectId = link.projectId;
  await query("UPDATE Project SET cancelledAt = NULL, cancelReason = NULL, kickoffAt = NOW(3) WHERE id = ?", [projectId]);
  await query("UPDATE Invoice SET status = 'PAID', paidAt = NOW(3) WHERE projectId = ?", [projectId]);
  await query("DELETE FROM Invoice WHERE number = ?", ["ATN/26-27/001"]);
  await setPhase(projectId, "BUILDING");
});

test("silence shows up on the projects list, and stops when it ends", async ({ page }) => {
  await signInAdmin(page);
  await page.goto("/admin");
  await expect(page.getByText(/needs attention/i)).toBeVisible();

  // A build with nothing said about it for longer than the window.
  await query("UPDATE Project SET kickoffAt = DATE_SUB(NOW(3), INTERVAL 9 DAY) WHERE id = ?", [projectId]);
  await query("UPDATE `Update` SET sentAt = DATE_SUB(NOW(3), INTERVAL 9 DAY) WHERE projectId = ?", [projectId]);
  await page.reload();
  await expect(page.getByText(/no weekly update for 9 days|building for 9 days with no update/i)).toBeVisible();

  // Say something, and it goes quiet again. Nothing had to be cleared.
  await query("UPDATE `Update` SET sentAt = NOW(3) WHERE projectId = ?", [projectId]);
  await query("UPDATE Project SET kickoffAt = NOW(3) WHERE id = ?", [projectId]);
  await page.reload();
  await expect(page.getByText(/no weekly update for 9 days|building for 9 days with no update/i)).toHaveCount(0);
});

test("an unpaid invoice is named, so it can be chased from the list", async ({ page }) => {
  // Its own invoice, not whichever one another spec happened to leave on the
  // seed project. Two specs have now been caught by that.
  const number = "ATN/26-27/001";
  await query("DELETE FROM Invoice WHERE number = ?", [number]);
  await query(
    `INSERT INTO Invoice (id, projectId, kind, number, issuedAt, description, amountPaise, taxAmountPaise, totalPaise, status)
     VALUES (?, ?, 'OTHER', ?, DATE_SUB(NOW(3), INTERVAL 8 DAY), 'An extra', 100000, 0, 100000, 'ISSUED')`,
    [`atn${Date.now()}`, projectId, number],
  );
  const invoice = { number };

  await signInAdmin(page);
  await page.goto("/admin");
  await expect(page.getByText(new RegExp(`${invoice.number.replace(/\//g, "\\/")} unpaid after 8 days`, "i"))).toBeVisible();
});

test("cancelling asks first, needs a reason, ends the project and says so", async ({ page }) => {
  await signInAdmin(page);
  await page.goto(`/admin/projects/${projectId}`);

  // The one irreversible move is a quiet link that opens a confirm (F-24).
  // The reason is required, and the browser stops an empty submit before
  // the action does.
  await page.getByRole("button", { name: /cancel this project/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /cancel the project/i }).click();
  expect(await dialog.locator('input[name="reason"]:invalid').count()).toBe(1);

  await dialog.locator('input[name="reason"]').fill("They paused the whole programme.");
  await dialog.getByRole("button", { name: /cancel the project/i }).click();

  // The page says so, the toast says so, and the link to cancel is gone.
  await expect(page.getByText(/^cancelled on /i)).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/cancelled/i);
  await expect(page.getByRole("button", { name: /cancel this project/i })).toHaveCount(0);
  const [p] = await query<{ phase: string; cancelReason: string }>(
    "SELECT phase, cancelReason FROM Project WHERE id = ?", [projectId],
  );
  expect(p.phase).toBe("CANCELLED");
  expect(p.cancelReason).toBe("They paused the whole programme.");
});

test("a cancelled project says nothing on the needs-attention block", async ({ page }) => {
  await query("UPDATE Project SET kickoffAt = DATE_SUB(NOW(3), INTERVAL 40 DAY) WHERE id = ?", [projectId]);
  await query("UPDATE `Update` SET sentAt = DATE_SUB(NOW(3), INTERVAL 40 DAY) WHERE projectId = ?", [projectId]);
  await setPhase(projectId, "CANCELLED");

  await signInAdmin(page);
  await page.goto("/admin");
  await expect(page.getByText(/no weekly update for 40 days/i)).toHaveCount(0);
});
