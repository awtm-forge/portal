import { expect, test } from "@playwright/test";
import { closeDb, freshLink, query, resetRateLimits, SEED_SLUG, setPhase, takeoverLatestCode } from "./fixtures";

/**
 * PORTAL-SPEC 6.1 and section 7. The weekly update on both sides, the week
 * counter, and the booking button that hides itself rather than breaking.
 */
const EMAIL = "e2e-updates@example.invalid";
const PASSWORD = "a-long-enough-passphrase";

let projectId = "";
let token = "";

test.afterAll(async () => {
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await query("UPDATE Company SET bookingUrl = NULL WHERE id = 'company'");
  await closeDb();
});

async function signInAdmin(page: import("@playwright/test").Page) {
  const { hash } = await import("bcryptjs");
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [EMAIL]);
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
    `e2eup${Date.now()}`, EMAIL, "Updates", await hash(PASSWORD, 12),
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
  await query("DELETE FROM `Update` WHERE projectId = ?", [projectId]);
  await query("UPDATE Project SET weekCount = 8 WHERE id = ?", [projectId]);
  await setPhase(projectId, "BUILDING");
});

test("an update is a draft until it is sent, and frozen after", async ({ page }) => {
  await signInAdmin(page);
  await page.goto(`/admin/projects/${projectId}/updates`);

  await page.getByLabel(/what moved/i).fill("Cart and checkout rebuilt on the new template.");
  await page.getByLabel(/what is next/i).fill("Wiring the returns flow.");
  await page.getByLabel(/risks/i).fill("None this week.");
  await page.getByRole("button", { name: /save as a draft/i }).click();
  await expect(page.getByText(/the client cannot see it yet/i)).toBeVisible();

  // A draft is invisible to the client. The week is whichever the build is in,
  // counted from the agreement's start date, not always week one.
  const beforeSend = await query<{ sentAt: string | null; weekNumber: number }>(
    "SELECT sentAt, weekNumber FROM `Update` WHERE projectId = ?",
    [projectId],
  );
  expect(beforeSend).toHaveLength(1);
  expect(beforeSend[0].sentAt).toBeNull();
  const week = beforeSend[0].weekNumber;
  expect(week).toBeGreaterThanOrEqual(1);

  await page.getByRole("button", { name: /send it to the client/i }).click();
  await expect(page.getByRole("heading", { name: /storefront and returns flow/i })).toBeVisible();

  // Sent, and now unchangeable.
  await page.goto(`/admin/projects/${projectId}/updates?week=${week}`);
  await expect(page.getByText(/the client has read this/i)).toBeVisible();
  await expect(page.getByLabel(/what moved/i)).toHaveCount(0);
});

test("the client sees the latest week in full, with the week counter", async ({ page }) => {
  await query(
    "INSERT INTO `Update` (id, projectId, weekNumber, moved, nextUp, needFromYou, risks, sentAt, createdAt, updatedAt) VALUES (?, ?, 1, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3)), (?, ?, 2, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))",
    [
      `u1${Date.now()}`, projectId, "Week one moved this.", "Week one next.", "", "None this week.",
      `u2${Date.now()}`, projectId, "Courier estimate now carries to payment.", "Wiring the returns flow.", "Courier API access", "None this week.",
    ],
  );
  await signInClient(page);

  await expect(page.getByText("Week 2 of 8")).toBeVisible();
  await expect(page.getByText(/courier estimate now carries to payment/i)).toBeVisible();
  await expect(page.getByText(/courier api access/i)).toBeVisible();

  // Earlier weeks are in the page but collapsed, so they are not competing
  // for attention with the current week.
  await expect(page.getByText(/week one moved this/i)).not.toBeVisible();
  await page.getByText(/earlier weeks/i).click();
  await page.getByText(/^week 1,/i).click();
  await expect(page.getByText(/week one moved this/i)).toBeVisible();
});

test("the booking button appears only when a booking link is set", async ({ page }) => {
  await query(
    "INSERT INTO `Update` (id, projectId, weekNumber, moved, nextUp, needFromYou, risks, sentAt, createdAt, updatedAt) VALUES (?, ?, 1, ?, ?, ?, ?, NOW(3), NOW(3), NOW(3))",
    [`ub${Date.now()}`, projectId, "Something moved.", "Something next.", "", "None this week."],
  );
  // Item 9 (11 Sep): "Book a meeting" is on every page. Without a booking link
  // it asks for a time over WhatsApp; with one it opens the calendar, which
  // since 12 Sep is a page of ours with the calendar framed in it.
  await query("UPDATE Company SET bookingUrl = NULL WHERE id = 'company'");
  await signInClient(page);
  await expect(page.getByRole("link", { name: /book a meeting/i })).toHaveAttribute("href", /wa\.me|^mailto:/);
  // With no link there is no page to send them to either.
  expect((await page.goto(`/p/${token}/book`))?.url()).toContain(`/p/${token}`);
  await expect(page.getByRole("heading", { name: /pick a time/i })).toHaveCount(0);

  await query("UPDATE Company SET bookingUrl = 'https://cal.com/awtm-forge/sync' WHERE id = 'company'");
  await page.goto(`/p/${token}`);
  await expect(page.getByRole("link", { name: /book a meeting/i })).toHaveAttribute("href", `/p/${token}/book`);

  await page.getByRole("link", { name: /book a meeting/i }).click();
  await expect(page.getByRole("heading", { name: /pick a time/i })).toBeVisible();
  // A cal.com page is framed, themed, and carries the client's own details so
  // they do not retype them. The frame is a separate origin on purpose.
  const src = await page.locator(".bookframe iframe").getAttribute("src");
  expect(src).toContain("https://cal.com/awtm-forge/sync");
  expect(src).toContain("theme=dark");
  expect(src).toContain("email=");
  expect(src).not.toContain("embed=true");
  // And a way out, in case the frame is ever blocked.
  await expect(page.getByRole("link", { name: /open the calendar in a new tab/i })).toHaveAttribute("href", "https://cal.com/awtm-forge/sync");

  // Anything that is not cal.com is framed exactly as it was pasted (15 Sep).
  // A Google appointment schedule carries its own embed parameter in the
  // address Google gives you, and cal.com's parameters mean nothing to it.
  const google = "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1test?gv=true";
  await query("UPDATE Company SET bookingUrl = ? WHERE id = 'company'", [google]);
  await page.goto(`/p/${token}/book`);
  expect(await page.locator(".bookframe iframe").getAttribute("src")).toBe(google);

  await query("UPDATE Company SET bookingUrl = NULL WHERE id = 'company'");
});

test("booking is for a client who is signed in, and signing out is in the menu", async ({ page }) => {
  // Ayush, 15 Sep. The code screen used to carry Book a meeting, which asked
  // somebody who had not proved who they are to go and book time with us.
  await query("UPDATE Company SET bookingUrl = 'https://cal.com/awtm-forge/sync' WHERE id = 'company'");
  await page.goto(`/p/${token}`);
  await expect(page.getByRole("button", { name: /email me a code/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /book a meeting/i })).toHaveCount(0);
  await expect(page.locator("header .p-cta")).toHaveCount(0);

  // Signed in it is back, and so is the way out of the session.
  await signInClient(page);
  await expect(page.getByRole("link", { name: /book a meeting/i })).toBeVisible();
  await page.getByRole("button", { name: /^menu$/i }).click();
  await page.getByRole("button", { name: /sign out of this device/i }).click();

  // Landed on the email login, and their own link now asks for a code again.
  await expect(page).toHaveURL(/\/p\/login$/);
  await page.goto(`/p/${token}`);
  await expect(page.getByRole("button", { name: /email me a code/i })).toBeVisible();

  await query("UPDATE Company SET bookingUrl = NULL WHERE id = 'company'");
});

test("marking the kickoff done is the one action that starts the build", async ({ page }) => {
  await setPhase(projectId, "AGREED");
  await signInAdmin(page);
  await page.goto(`/admin/projects/${projectId}`);

  await expect(page.getByText(/the one thing that moves this on/i)).toBeVisible();
  await page.getByRole("button", { name: /kickoff is done/i }).click();

  // Wait for the redirect to land before reading the database.
  await expect(page.getByText(/the one thing that moves this on/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /write the first one/i })).toBeVisible();

  const rows = await query<{ phase: string }>("SELECT phase FROM Project WHERE id = ?", [projectId]);
  expect(rows[0].phase).toBe("BUILDING");
});
