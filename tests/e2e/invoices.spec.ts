import { expect, test } from "@playwright/test";
import { closeDb, freshLink, INTAKE_SLUG, query, resetRateLimits, SEED_SLUG, takeoverLatestCode } from "./fixtures";

/**
 * PORTAL-SPEC 5.1, 5.7, 5.8 and 6.7, acceptance criteria 3, 12 and 16.
 * Marking paid, raising the one kind an admin may raise, and the printable
 * invoice: who can open it, and what it does and does not carry.
 */
const EMAIL = "e2e-invoices@example.invalid";
const PASSWORD = "a-long-enough-passphrase";

let projectId = "";
let token = "";

test.afterAll(async () => {
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await query("DELETE FROM Invoice WHERE number = ?", [TEST_NUMBER]);
  await query(
    "UPDATE Company SET gstin = NULL, bankName = NULL, bankAccountName = NULL, bankAccountNumber = NULL, bankIfsc = NULL, upiId = NULL WHERE id = 'company'",
  );
  await closeDb();
});

async function signInAdmin(page: import("@playwright/test").Page) {
  const { hash } = await import("bcryptjs");
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
    `e2einv${Date.now()}`, EMAIL, "Invoices", await hash(PASSWORD, 12),
  ]);
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /^projects$/i })).toBeVisible();
}

async function signInClient(page: import("@playwright/test").Page, forToken: string, forProject: string) {
  await page.goto(`/p/${forToken}`);
  await page.getByRole("button", { name: /email me a code/i }).click();
  await expect(page.getByLabel(/six digit code/i)).toBeVisible();
  await page.getByLabel(/six digit code/i).fill(await takeoverLatestCode(forProject, "LOGIN"));
  await page.getByRole("button", { name: /open my page/i }).click();
  await expect(page.getByRole("main").getByText("Your project", { exact: true })).toBeVisible();
}

/** The invoices sit in a fold that opens by itself only while one is unpaid; a test opens it either way. */
async function openInvoices(page: import("@playwright/test").Page) {
  const fold = page.locator("details.a-fold").filter({ has: page.locator(".fold-t", { hasText: "Invoices" }) });
  if (!(await fold.evaluate((d) => (d as HTMLDetailsElement).open))) await fold.locator(":scope > summary").click();
}

/** The block on the admin page for one invoice, found by its number. */
function invoiceRow(page: import("@playwright/test").Page, number: string) {
  return page.locator(".row").filter({ hasText: number });
}

/**
 * The invoice these tests act on. Made here rather than borrowed from whatever
 * an earlier spec left on the seed project: depending on that passed alone and
 * failed in the full run, which is the whole reason it is written this way.
 * The number is allocated by the real path in tests/invoices.test.ts and by
 * tests/invoice-numbering.test.ts; here it only has to be a number.
 */
const TEST_NUMBER = "TEST/26-27/001";

async function anIssuedInvoice(): Promise<{ id: string; number: string }> {
  const id = `e2einv${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  await query(
    `INSERT INTO Invoice (id, projectId, kind, number, issuedAt, description, amountPaise, taxAmountPaise, totalPaise, status)
     VALUES (?, ?, 'BALANCE', ?, NOW(3), ?, ?, 0, ?, 'ISSUED')`,
    [id, projectId, TEST_NUMBER, "Sundara Living storefront, balance on delivery", 24000000, 24000000],
  );
  return { id, number: TEST_NUMBER };
}

/** The latest invoice on the project, for the tests that raise a real one. */
async function latestInvoice(): Promise<{ id: string; number: string; status: string }> {
  const rows = await query<{ id: string; number: string; status: string }>(
    "SELECT id, number, status FROM Invoice WHERE projectId = ? ORDER BY issuedAt DESC, number DESC LIMIT 1",
    [projectId],
  );
  return rows[0];
}

test.beforeEach(async () => {
  await resetRateLimits();
  const link = await freshLink(SEED_SLUG);
  projectId = link.projectId;
  token = link.token;
  // Both directions: anything an earlier run of this spec left, and anything
  // an earlier spec raised on the seed project. Numbers consumed stay
  // consumed, which is correct: one is never handed out twice.
  await query("DELETE FROM Invoice WHERE projectId = ? AND (kind = 'OTHER' OR number = ?)", [projectId, TEST_NUMBER]);
  await query(
    "UPDATE Company SET gstin = NULL, bankName = 'HDFC Bank', bankAccountName = 'awtm forge', bankAccountNumber = '50200012345678', bankIfsc = 'HDFC0001234', upiId = NULL WHERE id = 'company'",
  );
});

test("an extra invoice is the only kind that can be raised by hand", async ({ page }) => {
  await signInAdmin(page);
  await page.goto(`/admin/projects/${projectId}`);

  // Criterion 3: nothing on this page offers to raise an advance or a balance.
  const body = (await page.locator("body").innerText()).toLowerCase();
  expect(body).not.toContain("raise the advance");
  expect(body).not.toContain("raise the balance");

  await openInvoices(page);
  await page.getByText(/raise an extra invoice/i).click();
  await page.getByLabel(/what it is for/i).fill("Two extra product photography sets");
  await page.getByLabel(/amount, in rupees/i).fill("18500");
  await page.getByRole("button", { name: /^raise it$/i }).click();

  await expect(page.getByText("Two extra product photography sets")).toBeVisible();
  const invoice = await latestInvoice();
  const rows = await query<{ kind: string; amountPaise: string; totalPaise: string }>(
    "SELECT kind, amountPaise, totalPaise FROM Invoice WHERE id = ?", [invoice.id],
  );
  expect(rows[0].kind).toBe("OTHER");
  expect(String(rows[0].amountPaise)).toBe("1850000");
  expect(String(rows[0].totalPaise)).toBe("1850000");
});

test("it refuses an amount that is not money, and says why", async ({ page }) => {
  await signInAdmin(page);
  await page.goto(`/admin/projects/${projectId}`);
  const before = await query<{ n: number }>("SELECT COUNT(*) AS n FROM Invoice WHERE projectId = ?", [projectId]);

  await openInvoices(page);
  await page.getByText(/raise an extra invoice/i).click();
  await page.getByLabel(/what it is for/i).fill("A thing");
  await page.getByLabel(/amount, in rupees/i).fill("nine hundred");
  await page.getByRole("button", { name: /^raise it$/i }).click();

  await expect(page.getByText(/number of rupees, more than zero/i)).toBeVisible();
  const after = await query<{ n: number }>("SELECT COUNT(*) AS n FROM Invoice WHERE projectId = ?", [projectId]);
  expect(Number(after[0].n)).toBe(Number(before[0].n));
});

test("marking one paid records the day and the reference, and cannot happen twice", async ({ page }) => {
  const invoice = await anIssuedInvoice();
  await signInAdmin(page);
  await page.goto(`/admin/projects/${projectId}`);

  await openInvoices(page);
  const row = invoiceRow(page, invoice.number);
  await row.getByText(/mark it paid/i).click();
  await row.getByLabel(/reference/i).fill("NEFT/778812");
  await row.getByRole("button", { name: /paid$/i }).click();

  // The page refreshes and says so; only then is the fold's state settled.
  await expect(page.getByRole("status")).toContainText(/marked paid/i);
  await openInvoices(page);
  await expect(invoiceRow(page, invoice.number).getByText(/^paid/i)).toBeVisible();
  const rows = await query<{ status: string; paidReference: string; paidAt: string }>(
    "SELECT status, paidReference, paidAt FROM Invoice WHERE id = ?", [invoice.id],
  );
  expect(rows[0].status).toBe("PAID");
  expect(rows[0].paidReference).toBe("NEFT/778812");
  expect(rows[0].paidAt).not.toBeNull();

  // The control is gone, because there is nothing left to move.
  await page.reload();
  await openInvoices(page);
  await expect(invoiceRow(page, invoice.number).getByText(/mark it paid/i)).toHaveCount(0);
});

test("the printable invoice carries the number, the total and the total in words", async ({ page }) => {
  await signInAdmin(page);
  const invoice = await anIssuedInvoice();
  await page.goto(`/invoice/${invoice.id}/print`);

  await expect(page.getByText(invoice.number)).toBeVisible();
  const [row] = await query<{ totalPaise: string }>("SELECT totalPaise FROM Invoice WHERE id = ?", [invoice.id]);
  const rupees = Number(BigInt(row.totalPaise) / 100n);
  const body = await page.locator("body").innerText();
  // Criterion 12: the words match the figure.
  expect(body).toContain(rupees.toLocaleString("en-IN"));
  expect(body.toLowerCase()).toContain("rupees only");
  // Bank details are on it, so the client knows where to send the money.
  expect(body).toContain("50200012345678");
  expect(body).toContain("HDFC0001234");
});

test("the tax block appears only once a GSTIN exists", async ({ page }) => {
  await signInAdmin(page);
  const invoice = await anIssuedInvoice();

  await page.goto(`/invoice/${invoice.id}/print`);
  await expect(page.getByText(/no tax is charged on this invoice/i)).toBeVisible();
  await expect(page.getByText(/GSTIN/)).toHaveCount(0);

  await query("UPDATE Company SET gstin = '29ABCDE1234F1Z5' WHERE id = 'company'");
  await page.goto(`/invoice/${invoice.id}/print`);
  await expect(page.getByText(/GSTIN 29ABCDE1234F1Z5/)).toBeVisible();
  await expect(page.getByText(/no tax is charged/i)).toHaveCount(0);
});

test("a client can open their own invoice, and no one else's", async ({ page, context, browser }) => {
  const invoice = await anIssuedInvoice();

  // Signed out: not found, not a login page. Nothing confirms the id exists.
  const anonymous = await context.request.get(`/invoice/${invoice.id}/print`, { maxRedirects: 0 });
  expect(anonymous.status()).toBe(404);

  await signInClient(page, token, projectId);
  await page.goto(`/invoice/${invoice.id}/print`);
  await expect(page.getByText(invoice.number)).toBeVisible();

  // The client of a different project cannot. A fresh context on purpose:
  // sessions are cookied per project, so one device may legitimately hold
  // several, and reusing this one would still be carrying the first.
  const other = await freshLink(INTAKE_SLUG);
  await resetRateLimits();
  const stranger = await browser.newContext();
  const strangerPage = await stranger.newPage();
  await signInClient(strangerPage, other.token, other.projectId);
  const response = await strangerPage.goto(`/invoice/${invoice.id}/print`);
  expect(response?.status()).toBe(404);
  await stranger.close();
});

test("the printable invoice never carries what the client must not see", async ({ page, request }) => {
  await signInAdmin(page);
  const invoice = await anIssuedInvoice();
  const cookies = await page.context().cookies();
  const header = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  const response = await request.get(`/invoice/${invoice.id}/print`, { headers: { cookie: header } });
  const body = await response.text();
  const [secret] = await query<{ internalCostPaise: string; internalNotes: string }>(
    "SELECT internalCostPaise, internalNotes FROM Agreement WHERE projectId = ?", [projectId],
  );
  if (secret?.internalCostPaise) expect(body).not.toContain(String(secret.internalCostPaise));
  if (secret?.internalNotes) expect(body).not.toContain(secret.internalNotes);
  // Criterion 18: the print route says stay out, as a header and a meta tag.
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  expect(body).toContain("noindex");
});
