import { expect, test } from "@playwright/test";
import {
  backToBuilding,
  closeDb,
  freshLink,
  openRoundDirect,
  query,
  resetRateLimits,
  SEED_SLUG,
  takeoverLatestCode,
} from "./fixtures";

/**
 * The review loop, PORTAL-SPEC 5.5 and 5.6, and acceptance criteria 2, 5, 6
 * and 24.
 */
const EMAIL = "e2e-review@example.invalid";
const PASSWORD = "a-long-enough-passphrase";

let projectId = "";
let token = "";

test.afterAll(async () => {
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await closeDb();
});

async function signInAdmin(page: import("@playwright/test").Page) {
  const { hash } = await import("bcryptjs");
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
    `e2erv${Date.now()}`, EMAIL, "Review", await hash(PASSWORD, 12),
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
  await expect(page.getByRole("main").getByText("Your project", { exact: true })).toBeVisible();
}

test.beforeEach(async () => {
  await resetRateLimits();
  const link = await freshLink(SEED_SLUG);
  projectId = link.projectId;
  token = link.token;
  await backToBuilding(projectId);
});

test("marking ready needs a link to the finished work, then opens round one", async ({ page }) => {
  await signInAdmin(page);
  await page.goto(`/admin/projects/${projectId}`);

  await expect(page.getByText("When the work is finished", { exact: true })).toBeVisible();
  await page.getByLabel(/where they can see the finished work/i).fill("not a url");
  await page.getByRole("button", { name: /mark it ready for them/i }).click();
  await expect(page.getByText(/needs to start with https/i)).toBeVisible();
  expect(await query("SELECT id FROM ReviewRound WHERE projectId = ?", [projectId])).toHaveLength(0);

  await page.getByLabel(/where they can see the finished work/i).fill("https://staging.example/sundara");
  await page.getByRole("button", { name: /mark it ready for them/i }).click();
  await expect(page.getByText(/review rounds/i)).toBeVisible();

  const rounds = await query<{ roundNumber: number; outcome: string; finishedWorkUrl: string }>(
    "SELECT roundNumber, outcome, finishedWorkUrl FROM ReviewRound WHERE projectId = ?",
    [projectId],
  );
  expect(rounds).toHaveLength(1);
  expect(rounds[0]).toMatchObject({ roundNumber: 1, outcome: "OPEN", finishedWorkUrl: "https://staging.example/sundara" });

  const phase = await query<{ phase: string }>("SELECT phase FROM Project WHERE id = ?", [projectId]);
  expect(phase[0].phase).toBe("IN_REVIEW");
});

test("the client sees what they agreed to, with how to check each one", async ({ page }) => {
  await openRoundDirect(projectId);
  await signInClient(page);

  // The one task on the home page, then the review itself.
  await expect(page.getByText(/check the finished work/i).first()).toBeVisible();
  await page.getByRole("link", { name: /review delivery/i }).click();
  await expect(page.getByText(/ready for you to check/i).first()).toBeVisible();

  await expect(page.getByText(/a storefront on the new template/i)).toBeVisible();
  await expect(page.getByText(/open three product pages on your phone/i)).toBeVisible();
  await expect(page.getByText(/raise a return on a real order/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /open the finished work/i })).toBeVisible();
});

test("saying what is off costs nothing and invoices nothing", async ({ page }) => {
  await openRoundDirect(projectId);
  await signInClient(page);
  await page.goto(`/p/${token}/review`);

  await page.getByPlaceholder(/the returns label comes out/i).fill("The returns label prints at the wrong size.");
  await page.getByRole("button", { name: /send this back to us/i }).click();
  await expect(page.getByText(/thank you, we have it/i)).toBeVisible();

  const rounds = await query<{ outcome: string; clientNote: string; respondedAt: string | null }>(
    "SELECT outcome, clientNote, respondedAt FROM ReviewRound WHERE projectId = ?",
    [projectId],
  );
  expect(rounds).toHaveLength(1);
  expect(rounds[0].outcome).toBe("CHANGES_REQUESTED");
  expect(rounds[0].clientNote).toContain("wrong size");
  expect(rounds[0].respondedAt).not.toBeNull();

  // Criterion 2: requesting changes creates no invoice, and no sign-off.
  expect(await query("SELECT id FROM Invoice WHERE projectId = ? AND kind = 'BALANCE'", [projectId])).toHaveLength(0);
  expect(await query("SELECT id FROM SignoffEvent WHERE projectId = ? AND kind = 'DELIVERY'", [projectId])).toHaveLength(0);

  const phase = await query<{ phase: string }>("SELECT phase FROM Project WHERE id = ?", [projectId]);
  expect(phase[0].phase).toBe("BUILDING");
});

test("a second round is opened and the first is still there, word for word", async ({ page }) => {
  await openRoundDirect(projectId, "https://staging.example/one");
  await query("UPDATE ReviewRound SET outcome = 'CHANGES_REQUESTED', clientNote = ?, respondedAt = NOW(3) WHERE projectId = ?", [
    "The label prints at the wrong size.", projectId,
  ]);
  await query("UPDATE Project SET phase = 'BUILDING' WHERE id = ?", [projectId]);

  await signInAdmin(page);
  await page.goto(`/admin/projects/${projectId}`);
  await page.getByLabel(/where they can see the finished work/i).fill("https://staging.example/two");
  await page.getByRole("button", { name: /mark it ready for them/i }).click();
  await expect(page.getByText(/round 2/i)).toBeVisible();

  const rounds = await query<{ roundNumber: number; outcome: string; clientNote: string | null }>(
    "SELECT roundNumber, outcome, clientNote FROM ReviewRound WHERE projectId = ? ORDER BY roundNumber",
    [projectId],
  );
  expect(rounds).toHaveLength(2);
  expect(rounds[0]).toMatchObject({ roundNumber: 1, outcome: "CHANGES_REQUESTED" });
  expect(rounds[0].clientNote).toBe("The label prints at the wrong size.");
  expect(rounds[1]).toMatchObject({ roundNumber: 2, outcome: "OPEN" });
});

test("signing off asks for a fresh code, then raises exactly one balance", async ({ page }) => {
  await openRoundDirect(projectId);
  await signInClient(page);
  await page.goto(`/p/${token}/review`);

  // Criterion 5: a fresh code even inside a valid session.
  await page.getByRole("button", { name: /it holds\. sign off the delivery\./i }).click();
  await expect(page.getByLabel(/six digit code/i)).toBeVisible();

  await page.getByLabel(/six digit code/i).fill("000000");
  await page.getByRole("button", { name: /confirm and sign off/i }).click();
  await expect(page.getByText(/wrong code/i)).toBeVisible();
  expect(await query("SELECT id FROM SignoffEvent WHERE projectId = ? AND kind = 'DELIVERY'", [projectId])).toHaveLength(0);

  await page.getByLabel(/six digit code/i).fill(await takeoverLatestCode(projectId, "DELIVERY"));
  await page.getByRole("button", { name: /confirm and sign off/i }).click();

  // Redirected once to the thank-you page.
  await expect(page.getByRole("heading", { name: /thank you\. it is delivered\./i })).toBeVisible();

  const invoices = await query<{ kind: string; totalPaise: string }>(
    "SELECT kind, totalPaise FROM Invoice WHERE projectId = ? AND kind = 'BALANCE'",
    [projectId],
  );
  expect(invoices).toHaveLength(1);
  expect(BigInt(invoices[0].totalPaise as never)).toBe(26000000n);

  const events = await query<{ method: string }>(
    "SELECT method FROM SignoffEvent WHERE projectId = ? AND kind = 'DELIVERY'",
    [projectId],
  );
  expect(events).toHaveLength(1);
  expect(events[0].method).toBe("PORTAL");

  const state = await query<{ phase: string; deliveredAt: string | null }>(
    "SELECT phase, deliveredAt FROM Project WHERE id = ?",
    [projectId],
  );
  expect(state[0].phase).toBe("DELIVERED");
  expect(state[0].deliveredAt).not.toBeNull();

  const day30 = await query<{ unlocksAt: string }>("SELECT unlocksAt FROM Day30 WHERE projectId = ?", [projectId]);
  expect(day30).toHaveLength(1);

  const rounds = await query<{ outcome: string }>("SELECT outcome FROM ReviewRound WHERE projectId = ?", [projectId]);
  expect(rounds[0].outcome).toBe("ACCEPTED");
});

test("the thank-you page is not there before delivery, and is after", async ({ page, request }) => {
  await openRoundDirect(projectId);
  await signInClient(page);

  // Criterion 24.
  const before = await request.get(`/p/${token}/thanks`, {
    headers: { cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") },
  });
  expect(before.status()).toBe(404);

  await query("UPDATE Project SET phase = 'DELIVERED', deliveredAt = NOW(3) WHERE id = ?", [projectId]);
  await page.goto(`/p/${token}/thanks`);
  await expect(page.getByRole("heading", { name: /thank you\. it is delivered\./i })).toBeVisible();
});

test("a quote and a referral are kept, and skipping is recorded too", async ({ page }) => {
  await openRoundDirect(projectId);
  await signInClient(page);
  await query("UPDATE Project SET phase = 'DELIVERED', deliveredAt = NOW(3) WHERE id = ?", [projectId]);

  await page.goto(`/p/${token}/thanks`);
  await page.getByLabel(/one or two lines on how this went/i).fill("The returns inbox is quiet for the first time in a year.");
  await page.getByPlaceholder(/their name/i).fill("Priya Nair");
  await page.getByRole("button", { name: /^send$/i }).click();
  await expect(page.getByText(/both their name and a way to reach them/i)).toBeVisible();

  await page.getByPlaceholder(/a number or an email/i).fill("priya@example.invalid");
  await page.getByRole("button", { name: /^send$/i }).click();
  await expect(page.getByRole("main").getByText("Your project", { exact: true })).toBeVisible();

  const testimonials = await query<{ status: string; text: string; useName: number }>(
    "SELECT status, text, useName FROM Testimonial WHERE projectId = ?",
    [projectId],
  );
  expect(testimonials).toHaveLength(1);
  expect(testimonials[0].status).toBe("DRAFT");
  expect(testimonials[0].text).toContain("returns inbox is quiet");
  expect(Number(testimonials[0].useName)).toBe(0);

  const referrals = await query<{ name: string; contact: string }>("SELECT name, contact FROM Referral WHERE projectId = ?", [projectId]);
  expect(referrals).toHaveLength(1);
  expect(referrals[0]).toMatchObject({ name: "Priya Nair", contact: "priya@example.invalid" });

  const seen = await query<{ thanksSeenAt: string | null }>("SELECT thanksSeenAt FROM Project WHERE id = ?", [projectId]);
  expect(seen[0].thanksSeenAt).not.toBeNull();
});

test("skipping records that they saw it and gave nothing", async ({ page }) => {
  await openRoundDirect(projectId);
  await signInClient(page);
  await query("UPDATE Project SET phase = 'DELIVERED', deliveredAt = NOW(3) WHERE id = ?", [projectId]);

  await page.goto(`/p/${token}/thanks`);
  await page.getByRole("button", { name: /^skip$/i }).click();
  await expect(page.getByRole("main").getByText("Your project", { exact: true })).toBeVisible();

  const seen = await query<{ thanksSeenAt: string | null }>("SELECT thanksSeenAt FROM Project WHERE id = ?", [projectId]);
  expect(seen[0].thanksSeenAt).not.toBeNull();
  expect(await query("SELECT id FROM Testimonial WHERE projectId = ?", [projectId])).toHaveLength(0);
  expect(await query("SELECT id FROM Referral WHERE projectId = ?", [projectId])).toHaveLength(0);
});
