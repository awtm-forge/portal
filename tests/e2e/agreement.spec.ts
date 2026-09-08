import { expect, test } from "@playwright/test";
import { closeDb, freshLink, query, resetRateLimits, SEED_SLUG, setPhase, takeoverLatestCode } from "./fixtures";

/**
 * The agreement journey: PORTAL-SPEC 6.3, and acceptance criteria 1, 5, 6 and
 * 7. The seed project is put back to agreement_sent for each test, and its
 * agreement and invoices are reset with it.
 */

async function backToSent(projectId: string): Promise<void> {
  await query("DELETE FROM Invoice WHERE projectId = ?", [projectId]);
  await query("DELETE FROM SignoffEvent WHERE projectId = ?", [projectId]);
  await query("DELETE FROM AgreementNote WHERE projectId = ?", [projectId]);
  await query(
    "UPDATE Agreement SET agreedAt = NULL, agreedByName = NULL, agreedMethod = NULL, version = 1, sentAt = NOW() WHERE projectId = ?",
    [projectId],
  );
  await setPhase(projectId, "AGREEMENT_SENT");
}

async function signIn(page: import("@playwright/test").Page, token: string, projectId: string) {
  await page.goto(`/p/${token}`);
  await page.getByRole("button", { name: /email me a code/i }).click();
  // Wait for the code screen before rewriting the code: the click returns
  // before the server action has written the row.
  await expect(page.getByLabel(/six digit code/i)).toBeVisible();
  const code = await takeoverLatestCode(projectId, "LOGIN");
  await page.getByLabel(/six digit code/i).fill(code);
  await page.getByRole("button", { name: /open my page/i }).click();
  // "Your project" only renders once the session cookie is accepted.
  await expect(page.getByText(/your project/i)).toBeVisible();
}

test.afterAll(async () => {
  await closeDb();
});

test.beforeEach(async () => {
  await resetRateLimits();
});

test("the client reads the agreement, agrees with a fresh code, and the advance is raised", async ({ page }) => {
  const { token, projectId } = await freshLink(SEED_SLUG);
  await backToSent(projectId);
  await signIn(page, token, projectId);

  // One thing to do: read the agreement.
  await page.getByRole("link", { name: /read the agreement/i }).click();
  await expect(page.getByRole("heading", { name: /what you get, and how you check it/i })).toBeVisible();
  await expect(page.getByText("Rs 5,20,000")).toBeVisible();

  // Criterion 5: agreeing asks for a fresh code even inside a valid session.
  await page.getByRole("button", { name: /^i agree$/i }).click();
  await expect(page.getByLabel(/six digit code/i)).toBeVisible();
  const code = await takeoverLatestCode(projectId, "AGREEMENT");
  await page.getByLabel(/six digit code/i).fill(code);
  await page.getByRole("button", { name: /confirm and agree/i }).click();

  await expect(page.getByRole("heading", { name: /^agreed$/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /^i agree$/i })).toHaveCount(0);

  // Criterion 1: exactly one advance invoice, for half of the total.
  const invoices = await query<{ kind: string; totalPaise: string; number: string }>(
    "SELECT kind, totalPaise, number FROM Invoice WHERE projectId = ?",
    [projectId],
  );
  expect(invoices).toHaveLength(1);
  expect(invoices[0].kind).toBe("ADVANCE");
  expect(BigInt(invoices[0].totalPaise as never)).toBe(26000000n);
  expect(invoices[0].number).toMatch(/^AWTM\/\d{2}-\d{2}\/\d{3}$/);

  // Criterion 6: a sign-off event exists and says how it happened.
  const events = await query<{ kind: string; method: string; actorName: string }>(
    "SELECT kind, method, actorName FROM SignoffEvent WHERE projectId = ?",
    [projectId],
  );
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ kind: "AGREEMENT", method: "PORTAL" });
});

test("a wrong code does not sign anything off", async ({ page }) => {
  const { token, projectId } = await freshLink(SEED_SLUG);
  await backToSent(projectId);
  await signIn(page, token, projectId);

  await page.goto(`/p/${token}/agreement`);
  await page.getByRole("button", { name: /^i agree$/i }).click();
  await expect(page.getByLabel(/six digit code/i)).toBeVisible();
  await page.getByLabel(/six digit code/i).fill("000000");
  await page.getByRole("button", { name: /confirm and agree/i }).click();

  await expect(page.getByText(/wrong code/i)).toBeVisible();
  const events = await query("SELECT id FROM SignoffEvent WHERE projectId = ?", [projectId]);
  expect(events).toHaveLength(0);
  const invoices = await query("SELECT id FROM Invoice WHERE projectId = ?", [projectId]);
  expect(invoices).toHaveLength(0);
});

test("pushing back needs no code, records a note and sends it back to draft", async ({ page }) => {
  const { token, projectId } = await freshLink(SEED_SLUG);
  await backToSent(projectId);
  await signIn(page, token, projectId);

  await page.goto(`/p/${token}/agreement`);
  await page.getByText(/something is off/i).click();
  await page.getByPlaceholder(/the launch date does not work/i).fill("The launch date lands in our stock week. Can we move it a fortnight?");
  await page.getByRole("button", { name: /^send$/i }).click();

  await expect(page.getByText(/thank you, we have it/i)).toBeVisible();

  const notes = await query<{ text: string; agreementVersion: number; enteredBy: string }>(
    "SELECT text, agreementVersion, enteredBy FROM AgreementNote WHERE projectId = ?",
    [projectId],
  );
  expect(notes).toHaveLength(1);
  expect(notes[0].enteredBy).toBe("client");
  const phase = await query<{ phase: string }>("SELECT phase FROM Project WHERE id = ?", [projectId]);
  expect(phase[0].phase).toBe("AGREEMENT_DRAFT");
  const events = await query("SELECT id FROM SignoffEvent WHERE projectId = ?", [projectId]);
  expect(events).toHaveLength(0);
});

test("an agreed agreement is frozen: no button, and the record is stamped", async ({ page }) => {
  const { token, projectId } = await freshLink(SEED_SLUG);
  await backToSent(projectId);
  await query(
    "UPDATE Agreement SET agreedAt = NOW(), agreedByName = 'Arjun Sundaram', agreedMethod = 'PORTAL' WHERE projectId = ?",
    [projectId],
  );
  await setPhase(projectId, "BUILDING");
  await signIn(page, token, projectId);

  await page.goto(`/p/${token}/agreement`);
  await expect(page.getByText(/agreed by arjun sundaram/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /^i agree$/i })).toHaveCount(0);
  await expect(page.getByText(/something is off/i)).toHaveCount(0);
});

test("the printable agreement carries the stamp and no navigation", async ({ page }) => {
  const { token, projectId } = await freshLink(SEED_SLUG);
  await backToSent(projectId);
  await query("UPDATE Agreement SET agreedAt = NOW(), agreedByName = 'Arjun Sundaram', agreedMethod = 'PORTAL' WHERE projectId = ?", [projectId]);
  await signIn(page, token, projectId);

  await page.goto(`/agreement/${token}/print`);
  await expect(page.getByRole("heading", { name: /what we are building/i })).toBeVisible();
  await expect(page.getByText(/agreed by arjun sundaram/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /save it as a pdf/i })).toHaveCount(0);
});

test("on a phone the questionnaire page shows one button above the fold", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone project only");
  const { token, projectId } = await freshLink(SEED_SLUG);
  await backToSent(projectId);
  await signIn(page, token, projectId);

  // Criterion 13: no navigation anywhere in the client zone.
  await expect(page.locator("nav")).toHaveCount(0);
  const viewport = page.viewportSize();
  const buttons = page.getByRole("button").or(page.getByRole("link"));
  const count = await buttons.count();
  let aboveFold = 0;
  for (let i = 0; i < count; i++) {
    const box = await buttons.nth(i).boundingBox();
    if (box && viewport && box.y < viewport.height) aboveFold += 1;
  }
  expect(aboveFold).toBeLessThanOrEqual(1);
});
