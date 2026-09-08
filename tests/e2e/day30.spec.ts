import { expect, test } from "@playwright/test";
import { backToBuilding, closeDb, day30Open, freshLink, INTAKE_SLUG, query, resetRateLimits, SEED_SLUG, takeoverLatestCode } from "./fixtures";

const EMAIL = "e2e-day30@example.invalid";
const PASSWORD = "a-long-enough-passphrase";

/**
 * PORTAL-SPEC 6.1 and 6.5, acceptance criterion 10. The page is not there
 * before the date and is after it, with nothing scheduled in between.
 */
let projectId = "";
let token = "";

test.afterAll(async () => {
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await backToBuilding(projectId);
  await closeDb();
});

async function signInAdmin(page: import("@playwright/test").Page) {
  const { hash } = await import("bcryptjs");
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
    `e2ed30${Date.now()}`, EMAIL, "Day30", await hash(PASSWORD, 12),
  ]);
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /^projects$/i })).toBeVisible();
}

async function signInClient(page: import("@playwright/test").Page) {
  await page.goto(`/p/${token}`);
  await page.getByRole("button", { name: /email me a code/i }).click();
  await expect(page.getByLabel(/six digit code/i)).toBeVisible();
  await page.getByLabel(/six digit code/i).fill(await takeoverLatestCode(projectId, "LOGIN"));
  await page.getByRole("button", { name: /open my page/i }).click();
  await expect(page.getByText("Your project", { exact: true })).toBeVisible();
}

test.beforeEach(async () => {
  await resetRateLimits();
  const link = await freshLink(SEED_SLUG);
  projectId = link.projectId;
  token = link.token;
  await query("UPDATE Project SET metricName = ?, metricBaselineValue = ? WHERE id = ?", [
    "Checkout completion", "41 percent", projectId,
  ]);
  // No test inherits another's quote. The invoices spec taught this lesson:
  // a spec that leans on what ran before it passes alone and fails in the run.
  await query("DELETE FROM Testimonial WHERE projectId = ?", [projectId]);
});

test("the page is not there before the month is up", async ({ page }) => {
  await day30Open(projectId, { unlocked: false });
  await signInClient(page);

  // Criterion 10: no way in, and nothing on the project page pointing at one.
  await expect(page.getByRole("link", { name: /open it/i })).toHaveCount(0);
  const response = await page.goto(`/p/${token}/day30`);
  expect(response?.status()).toBe(404);
});

test("on the day it is the one thing to do, and it opens", async ({ page }) => {
  await day30Open(projectId);
  await signInClient(page);

  await expect(page.getByText("One month in. Two things, under a minute.")).toBeVisible();
  await page.getByRole("link", { name: /open it/i }).click();
  await expect(page.getByRole("heading", { name: /two things, under a minute/i })).toBeVisible();
  await expect(page.getByText(/checkout completion, and now\?/i)).toBeVisible();
  await expect(page.getByText(/it was 41 percent when we started/i)).toBeVisible();
});

test("the box starts with what they wrote on the day we delivered", async ({ page }) => {
  await day30Open(projectId);
  await query(
    "INSERT INTO Testimonial (id, projectId, moment, text, status, createdAt, updatedAt) VALUES (?, ?, 'DELIVERY', ?, 'DRAFT', NOW(3), NOW(3))",
    [`t${Date.now()}`, projectId, "Rough on the day but it works."],
  );
  await signInClient(page);
  await page.goto(`/p/${token}/day30`);
  await expect(page.locator('textarea[name="quote"]')).toHaveValue("Rough on the day but it works.");
});

test("the number and the quote are kept, and the switches are off unless ticked", async ({ page }) => {
  await day30Open(projectId);
  await signInClient(page);
  await page.goto(`/p/${token}/day30`);

  await page.locator('input[name="metricAfter"]').fill("63 percent");
  await page.locator('textarea[name="quote"]').fill("Six weeks on, it holds.");
  await page.locator('input[name="useName"]').check();
  await page.getByRole("button", { name: /approve and send/i }).click();

  await expect(page.getByText("Your project", { exact: true })).toBeVisible();
  const [row] = await query<{ metricAfterValue: string; metricAfterSubmittedAt: string }>(
    "SELECT metricAfterValue, metricAfterSubmittedAt FROM Day30 WHERE projectId = ?", [projectId],
  );
  expect(row.metricAfterValue).toBe("63 percent");
  expect(row.metricAfterSubmittedAt).not.toBeNull();

  const [t] = await query<{ text: string; status: string; useName: number; useLogo: number; approvedMethod: string }>(
    "SELECT text, status, useName, useLogo, approvedMethod FROM Testimonial WHERE projectId = ? AND moment = 'DAY30'", [projectId],
  );
  expect(t.text).toBe("Six weeks on, it holds.");
  expect(t.status).toBe("APPROVED");
  expect(Number(t.useName)).toBe(1);
  expect(Number(t.useLogo)).toBe(0);
  expect(t.approvedMethod).toBe("PORTAL");
});

test("once answered it says so, and the project page stops asking", async ({ page }) => {
  await day30Open(projectId);
  await signInClient(page);
  await page.goto(`/p/${token}/day30`);
  await page.getByRole("button", { name: /approve and send/i }).click();
  // Prove the answer landed before asserting on what changed: without this,
  // a form that silently did nothing would still satisfy the checks below.
  await expect(page.getByText("Your project", { exact: true })).toBeVisible();

  await expect(page.getByRole("link", { name: /open it/i })).toHaveCount(0);
  await page.goto(`/p/${token}/day30`);
  await expect(page.getByText(/already answered this/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /approve and send/i })).toHaveCount(0);
});

test("opening it is recorded, which is what the needs-attention block will read", async ({ page }) => {
  await day30Open(projectId);
  await signInClient(page);
  await page.goto(`/p/${token}/day30`);
  const [row] = await query<{ openedAt: string | null }>("SELECT openedAt FROM Day30 WHERE projectId = ?", [projectId]);
  expect(row.openedAt).not.toBeNull();
});

test("admin sees the day-30 state and keeps friction notes off every client page", async ({ page, request }) => {
  await day30Open(projectId);
  await signInAdmin(page);
  await page.goto(`/admin/projects/${projectId}`);

  await expect(page.getByText(/^day 30$/i)).toBeVisible();
  const notes = "Zzyxth the logo round took three goes";
  await page.locator('textarea[name="frictionNotes"]').fill(notes);
  await page.getByRole("button", { name: /save the notes/i }).click();
  await expect(page.locator('textarea[name="frictionNotes"]')).toHaveValue(notes);

  // ADMIN ONLY in the schema, and there is no client view with a field for it.
  const cookies = await page.context().cookies();
  const header = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  for (const route of [`/p/${token}`, `/p/${token}/day30`, `/p/${token}/thanks`]) {
    const body = await (await request.get(route, { headers: { cookie: header } })).text();
    expect(body, `${route} leaked the friction notes`).not.toContain("Zzyxth");
  }
});

test("a quote they approved on WhatsApp is recorded as such, not as a tap", async ({ page }) => {
  await day30Open(projectId);
  await query(
    "INSERT INTO Testimonial (id, projectId, moment, text, status, createdAt, updatedAt) VALUES (?, ?, 'DELIVERY', ?, 'DRAFT', NOW(3), NOW(3))",
    [`t${Date.now()}`, projectId, "They said this one on a call."],
  );
  await signInAdmin(page);
  await page.goto(`/admin/projects/${projectId}`);

  await expect(page.getByText(/draft, not for use/i)).toBeVisible();
  await page.getByRole("button", { name: /said yes on whatsapp/i }).click();
  await expect(page.getByText(/^approved$/i).first()).toBeVisible();

  const [t] = await query<{ status: string; approvedMethod: string }>(
    "SELECT status, approvedMethod FROM Testimonial WHERE projectId = ? AND moment = 'DELIVERY'", [projectId],
  );
  expect(t.status).toBe("APPROVED");
  // PORTAL-SPEC 5.11: the two methods stay distinguishable for ever.
  expect(t.approvedMethod).toBe("WHATSAPP");
});

test("closing a delivered project leaves the record readable at the same link", async ({ page }) => {
  await day30Open(projectId);
  await signInAdmin(page);
  await page.goto(`/admin/projects/${projectId}`);

  await page.getByRole("button", { name: /close this project/i }).click();
  await expect(page.getByRole("button", { name: /close this project/i })).toHaveCount(0);

  const [p] = await query<{ phase: string }>("SELECT phase FROM Project WHERE id = ?", [projectId]);
  expect(p.phase).toBe("CLOSED");

  await page.goto(`/p/${token}`);
  await page.getByRole("button", { name: /email me a code/i }).click();
  await expect(page.getByLabel(/six digit code/i)).toBeVisible();
  await page.getByLabel(/six digit code/i).fill(await takeoverLatestCode(projectId, "LOGIN"));
  await page.getByRole("button", { name: /open my page/i }).click();
  await expect(page.getByText(/delivered on/i)).toBeVisible();
});

test("a draft belonging to another project never reaches this one's box", async ({ page }) => {
  // Criterion 26, narrowed by QUESTIONS.md Q9: a draft appears in exactly one
  // place outside admin, the day-30 box of the project that wrote it. This is
  // the check that the narrowing is only that wide.
  await day30Open(projectId);
  const other = await freshLink(INTAKE_SLUG);
  const secret = "Zzyxth another project's unapproved words";
  await query("DELETE FROM Testimonial WHERE projectId = ?", [other.projectId]);
  await query(
    "INSERT INTO Testimonial (id, projectId, moment, text, status, createdAt, updatedAt) VALUES (?, ?, 'DELIVERY', ?, 'DRAFT', NOW(3), NOW(3))",
    [`t${Date.now()}x`, other.projectId, secret],
  );

  await resetRateLimits();
  await signInClient(page);
  await page.goto(`/p/${token}/day30`);
  expect(await page.locator("body").innerText()).not.toContain("Zzyxth");
  await expect(page.locator('textarea[name="quote"]')).toHaveValue("");

  await query("DELETE FROM Testimonial WHERE projectId = ?", [other.projectId]);
});
