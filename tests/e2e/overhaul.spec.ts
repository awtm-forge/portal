import { expect, test, type Page } from "@playwright/test";
import { backToBuilding, closeDb, day30Open, freshLink, query, resetRateLimits, SEED_SLUG, setPhase, takeoverLatestCode } from "./fixtures";

/**
 * The UX overhaul of 11 Sep 2026 (docs/ux-overhaul). Each test pins one
 * decision from 04-design-decisions.md, so the next pass cannot quietly undo it.
 */

const ADMIN_EMAIL = "e2e-overhaul@example.invalid";

async function signInClient(page: Page, token: string, projectId: string) {
  await resetRateLimits();
  await page.goto(`/p/${token}`);
  await page.getByRole("button", { name: /email me a code/i }).click();
  await expect(page.getByLabel(/six digit code/i)).toBeVisible();
  await page.getByLabel(/six digit code/i).fill(await takeoverLatestCode(projectId, "LOGIN"));
  await page.getByRole("button", { name: /open my page/i }).click();
  // The menu button is on every signed-in page, whatever the client has.
  await expect(page.getByRole("button", { name: /menu/i })).toBeVisible();
}

async function signInAdmin(page: Page) {
  const { hash } = await import("bcryptjs");
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
    `e2eov${Date.now()}`, ADMIN_EMAIL, "Overhaul", await hash("a-long-enough-passphrase", 12),
  ]);
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill("a-long-enough-passphrase");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /^projects$/i })).toBeVisible();
}

test.afterAll(async () => {
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  await closeDb();
});

test("a cancelled project says it was closed, with the date, and asks for nothing (D-01)", async ({ page }) => {
  const { token, projectId } = await freshLink(SEED_SLUG);
  await backToBuilding(projectId);
  // The trap: a delivered project with day 30 open, then cancelled. The
  // check-in used to outrank the phase.
  await day30Open(projectId);
  await query("UPDATE Project SET cancelledAt = NOW(3), cancelReason = 'e2e' WHERE id = ?", [projectId]);
  await setPhase(projectId, "CANCELLED");

  await signInClient(page, token, projectId);
  await expect(page.getByText(/this project was closed on/i)).toBeVisible();
  await expect(page.getByText(/pending task/i)).toHaveCount(0);
  await expect(page.getByText(/month-on check-in/i)).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Project progress" })).toHaveCount(0);
  // The reason is ours and never reaches the page.
  await expect(page.getByText("e2e", { exact: true })).toHaveCount(0);

  await query("UPDATE Project SET cancelledAt = NULL, cancelReason = NULL WHERE id = ?", [projectId]);
  await backToBuilding(projectId);
});

test("a delivered project is one card, carrying the thank-you ask until it is seen", async ({ page }) => {
  const { token, projectId } = await freshLink(SEED_SLUG);
  await backToBuilding(projectId);
  await day30Open(projectId, { unlocked: false });
  await query("UPDATE Project SET thanksSeenAt = NULL WHERE id = ?", [projectId]);

  await signInClient(page, token, projectId);
  await expect(page.getByText(/where things stand/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /say how it went/i })).toBeVisible();
  await expect(page.locator(".card.stand")).toHaveCount(1);

  await query("UPDATE Project SET thanksSeenAt = NOW(3) WHERE id = ?", [projectId]);
  await page.reload();
  await expect(page.getByRole("link", { name: /say how it went/i })).toHaveCount(0);
  await expect(page.locator(".card.stand")).toHaveCount(1);

  await backToBuilding(projectId);
});

test("the locked questionnaire shows what was answered, and the ask sits at the top (F-07, F-08)", async ({ page }) => {
  const { token, projectId, clientId } = await freshLink(SEED_SLUG);
  await query("DELETE FROM IntakeChangeRequest WHERE clientId = ?", [clientId]);
  await signInClient(page, token, projectId);
  await page.goto(`/p/${token}/intake`);

  await expect(page.getByText(/tap to add/i)).toHaveCount(0);
  await expect(page.getByText(/not answered\./i).first()).toBeVisible();
  const ask = await page.locator("#ask-change").boundingBox();
  const firstSection = await page.locator(".card-h").first().boundingBox();
  expect(ask?.y ?? Infinity).toBeLessThan(firstSection?.y ?? 0);
  await expect(page.locator("#ask-change").getByRole("button", { name: /request a change/i })).toBeVisible();
});

test("on a phone the agreement keeps I agree within reach, and the bar never agrees for you (F-05)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone project only");
  const { token, projectId } = await freshLink(SEED_SLUG);
  await query("UPDATE Agreement SET agreedAt = NULL, sentAt = COALESCE(sentAt, NOW(3)) WHERE projectId = ?", [projectId]);
  await setPhase(projectId, "AGREEMENT_SENT");
  await signInClient(page, token, projectId);
  await page.goto(`/p/${token}/agreement`);

  const bar = page.locator(".sticky-act");
  await expect(bar).toHaveClass(/\bon\b/);
  await expect(page.locator("#agree-btn")).not.toBeInViewport();
  await bar.getByRole("link", { name: /i agree/i }).click();
  await expect(page.locator("#agree-btn")).toBeInViewport();
  await expect(page.locator("#agree-btn")).toBeFocused();
  await expect(bar).not.toHaveClass(/\bon\b/);
  // Still not agreed: the bar only scrolled.
  const [a] = await query<{ agreedAt: Date | null }>("SELECT agreedAt FROM Agreement WHERE projectId = ?", [projectId]);
  expect(a.agreedAt).toBeNull();

  await backToBuilding(projectId);
});

test("the month-on notice is written once, and the updates page groups by day (F-14, F-16)", async ({ page }) => {
  const { token, projectId, clientId } = await freshLink(SEED_SLUG);
  await backToBuilding(projectId);
  await day30Open(projectId);
  await query("DELETE FROM ClientNotification WHERE clientId = ? AND kind = 'day30.due'", [clientId]);

  await signInClient(page, token, projectId);
  await page.reload();
  const rows = await query<{ id: string }>("SELECT id FROM ClientNotification WHERE clientId = ? AND kind = 'day30.due'", [clientId]);
  expect(rows).toHaveLength(1);

  await page.goto(`/p/${token}/updates`);
  await expect(page.getByText(/^today$/i)).toBeVisible();
  await expect(page.getByText(/one month on/i).first()).toBeVisible();

  await query("DELETE FROM ClientNotification WHERE clientId = ? AND kind = 'day30.due'", [clientId]);
  await backToBuilding(projectId);
});

test("the client hears back after an action that ends in a redirect", async ({ page }) => {
  // Every client action confirms itself: the ones that stay on the page do it
  // in the page, the ones that redirect do it with a toast on the page they
  // land on. Before this, sending a testimonial or the month-on answer landed
  // the client back home with nothing said at all (Ayush, 12 Sep).
  const { token, projectId } = await freshLink(SEED_SLUG);
  await backToBuilding(projectId);
  await day30Open(projectId);
  await query("UPDATE Project SET thanksSeenAt = NULL WHERE id = ?", [projectId]);
  await query("DELETE FROM Testimonial WHERE projectId = ?", [projectId]);
  await signInClient(page, token, projectId);

  await page.goto(`/p/${token}/thanks`);
  await page.getByRole("button", { name: /^send$/i }).click();
  await expect(page.getByRole("status")).toContainText(/thank you, we have it/i);

  await page.goto(`/p/${token}/day30`);
  await page.locator('input[name="metricAfter"]').fill("58 percent");
  await page.getByRole("button", { name: /approve and send/i }).click();
  await expect(page.getByRole("status")).toContainText(/that is everything/i);

  await query("DELETE FROM Testimonial WHERE projectId = ?", [projectId]);
  await backToBuilding(projectId);
});

test("an admin action says it worked, and the irreversible ones ask first (F-30, F-34)", async ({ page }) => {
  const { projectId } = await freshLink(SEED_SLUG);
  await backToBuilding(projectId);
  await day30Open(projectId);
  const referralId = `e2eov${Date.now()}`;
  await query("INSERT INTO Referral (id, projectId, name, contact, createdAt) VALUES (?, ?, 'Zzyxth Named', 'named@example.invalid', NOW(3))", [referralId, projectId]);

  await signInAdmin(page);
  await page.goto(`/admin/projects/${projectId}`);

  // A plain save confirms itself with a toast.
  await page.getByLabel(/friction notes/i).fill("The label printer.");
  await page.getByRole("button", { name: /save the notes/i }).click();
  await expect(page.getByRole("status")).toContainText(/notes saved/i);

  // Forgetting someone asks first; the safe choice does nothing.
  await page.getByRole("button", { name: /forget them/i }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /keep it/i }).click();
  await expect(dialog).toBeHidden();
  expect(await query("SELECT id FROM Referral WHERE id = ?", [referralId])).toHaveLength(1);

  await page.getByRole("button", { name: /forget them/i }).click();
  await dialog.getByRole("button", { name: /^forget them$/i }).click();
  await expect(page.getByRole("status")).toContainText(/forgotten/i);
  expect(await query("SELECT id FROM Referral WHERE id = ?", [referralId])).toHaveLength(0);

  await backToBuilding(projectId);
});

test("ending a project is one tap from the top, in one slot whatever the phase", async ({ page }) => {
  // Ayush asked twice where the cancel control was (11 and 12 Sep). It is a
  // quiet link, but it is in the title row, not at the foot of the record.
  const { projectId } = await freshLink(SEED_SLUG);
  await backToBuilding(projectId);
  await signInAdmin(page);
  await page.goto(`/admin/projects/${projectId}`);
  await expect(page.getByRole("button", { name: /cancel this project/i })).toBeInViewport();

  // Delivered: the same slot carries Close, and Cancel is gone.
  await day30Open(projectId);
  await page.reload();
  await expect(page.getByRole("button", { name: /cancel this project/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /close this project/i })).toBeInViewport();

  await backToBuilding(projectId);
});

test("a client with only one page still has a way back from the booking page", async ({ page }) => {
  // The row lists the pages a client has. One with no questionnaire, no
  // agreement and no invoice has a single page, and the row was hidden
  // whenever it held fewer than two, which left the booking page with nothing
  // to go back to but the wordmark (Ayush, 12 Sep).
  const bare = await query<{ slug: string; id: string }>(
    "SELECT p.slug, p.id FROM Project p LEFT JOIN Intake i ON i.clientId = p.clientId WHERE i.id IS NULL LIMIT 1",
  );
  test.skip(bare.length === 0, "the seed has no client without a questionnaire");
  await query("UPDATE Company SET bookingUrl = 'https://calendar.example/awtm' WHERE id = 'company'");
  const link = await freshLink(bare[0].slug);
  await signInClient(page, link.token, link.projectId);

  await page.goto(`/p/${link.token}/book`);
  await expect(page.getByRole("heading", { name: /pick a time/i })).toBeVisible();
  // A client with one page has no page links, so the wordmark is the way back.
  const back = page.getByRole("banner").getByRole("link", { name: /awtm forge/i });
  await expect(back).toBeVisible();
  await back.click();
  await expect(page).toHaveURL(new RegExp(`/p/${link.token}$`));

  await query("UPDATE Company SET bookingUrl = NULL WHERE id = 'company'");
});

test("the team has notifications too, counted on the nav and cleared by reading", async ({ page }) => {
  // ADR 0020: the feed is the activity log, and each admin keeps one marker.
  const { projectId } = await freshLink(SEED_SLUG);
  const mark = `Zzyxth notify ${Date.now()}`;
  await query(
    "INSERT INTO ActivityEvent (id, projectId, type, payload, actor, createdAt) VALUES (?, ?, 'intake.submitted', ?, 'client', NOW(3))",
    [`ev${Date.now()}`, projectId, JSON.stringify({ projectName: mark, businessName: "Sundara Living" })],
  );

  await signInAdmin(page);
  await page.goto("/admin");
  await expect(page.locator(".a-count")).toBeVisible();

  await page.getByRole("link", { name: /notifications/i }).click();
  await expect(page.getByRole("heading", { name: /^notifications$/i })).toBeVisible();
  await expect(page.getByText(`${mark}: questionnaire sent`)).toBeVisible();

  // Reading it moves this admin's marker, so the count goes.
  await page.goto("/admin");
  await expect(page.locator(".a-count")).toHaveCount(0);

  await query("DELETE FROM ActivityEvent WHERE type = 'intake.submitted' AND payload LIKE ?", [`%${mark}%`]);
});

test("the client's bell is outside the menu, so news is one tap away", async ({ page }) => {
  const { token, projectId } = await freshLink(SEED_SLUG);
  await backToBuilding(projectId);
  await signInClient(page, token, projectId);

  // In the header, not behind the menu button (Ayush, 13 Sep).
  const bell = page.locator(".p-head-actions").getByRole("link", { name: /updates/i });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page).toHaveURL(new RegExp(`/p/${token}/updates$`));

  // And the menu no longer repeats it.
  await page.getByRole("button", { name: /menu/i }).click();
  await expect(page.locator(".pmenu-panel").getByRole("link", { name: /updates/i })).toHaveCount(0);
});

test("the way home is the wordmark, on every client page", async ({ page }) => {
  // The back and forward chevrons added on 13 Sep were taken out the same day
  // by the home page audit: inside a portal this small they read as browser
  // furniture. The concern they answered is real, so what replaced them is
  // tested instead. A client in WhatsApp's browser, which has no chrome of its
  // own, still has a way back from every page.
  const { token, projectId } = await freshLink(SEED_SLUG);
  await backToBuilding(projectId);
  await signInClient(page, token, projectId);

  await expect(page.getByRole("button", { name: "Go back" }), "the chevrons are gone").toHaveCount(0);

  for (const path of ["/intake", "/agreement", "/invoices"]) {
    await page.goto(`/p/${token}${path}`);
    const home = page.getByRole("banner").getByRole("link", { name: /awtm forge/i });
    await expect(home).toHaveAttribute("href", `/p/${token}`);
    await home.click();
    await expect(page).toHaveURL(new RegExp(`/p/${token}$`));
  }
});

test("the dashboard says who each project is waiting on (F-20)", async ({ page }) => {
  const { projectId } = await freshLink(SEED_SLUG);
  await backToBuilding(projectId);
  await signInAdmin(page);
  await page.goto("/admin");
  const cell = page.locator('td[data-label="Waiting on"]').first();
  await expect(cell).toBeVisible();
  await expect(cell).toContainText(/the client|us|nobody/i);
  await expect(page.locator('td[data-label="Stage"]').first()).toBeVisible();
});

test("the admin frame fits a phone: a bar, and the nav gets the width of it (F-21)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone project only");
  await signInAdmin(page);
  await page.goto("/admin");

  // A bar, not the laptop's sidebar. It takes two lines under 760 px: on one
  // line the arrows, the wordmark and the theme switch left the nav 85 px of a
  // 390 px screen, which is one of five items (14 Sep).
  const side = await page.locator(".a-side").boundingBox();
  const view = page.viewportSize();
  expect(side?.height ?? 999, "a bar, not a sidebar").toBeLessThan(110);
  expect(side?.width ?? 0, "the full width of the phone").toBeGreaterThan((view?.width ?? 0) - 2);

  const nav = await page.locator(".a-navs").boundingBox();
  expect(nav?.height ?? 999, "the nav is a row, not a column").toBeLessThan(50);
  expect(nav?.width ?? 0, "and it gets the whole bar to itself").toBeGreaterThan((view?.width ?? 0) - 2);

  await expect(page.getByRole("link", { name: /settings/i })).toBeVisible();
});

test("the way in offers the email login, and the login page asks for the email first (F-10)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /log in with your email/i }).click();
  await expect(page).toHaveURL(/\/p\/login$/);
  await expect(page.getByLabel(/your email/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /email me a code/i })).toBeVisible();
});
