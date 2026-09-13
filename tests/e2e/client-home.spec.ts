import { expect, test, type Page } from "@playwright/test";
import { backToBuilding, closeDb, freshLink, query, resetRateLimits, SEED_SLUG, setPhase, takeoverLatestCode } from "./fixtures";

/**
 * The client home page, walked through all five stages by driving the admin
 * side the way the team actually does it, asserting at each step the three
 * things the page is for: the chip, the headline, and whether there is a
 * button and what it says.
 *
 * It is one test rather than five, on purpose. The stages are sequential and
 * the point is that the page keeps telling the truth as a project moves, which
 * five independent tests each planting their own row would not prove.
 */

const ADMIN_EMAIL = "e2e-home@example.invalid";
const PASSWORD = "a-long-enough-passphrase";

async function signInAdmin(page: Page) {
  const { hash } = await import("bcryptjs");
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
    `e2ehome${Date.now()}`, ADMIN_EMAIL, "Home walk", await hash(PASSWORD, 12),
  ]);
  await page.goto("/admin/login");
  await page.getByLabel(/email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /^projects$/i })).toBeVisible();
}

async function signInClient(page: Page, token: string, projectId: string) {
  await resetRateLimits();
  await page.goto(`/p/${token}`);
  await page.getByRole("button", { name: /email me a code/i }).click();
  await expect(page.getByLabel(/six digit code/i)).toBeVisible();
  await page.getByLabel(/six digit code/i).fill(await takeoverLatestCode(projectId, "LOGIN"));
  await page.getByRole("button", { name: /open my page/i }).click();
  await expect(page.getByRole("button", { name: /menu/i })).toBeVisible();
}

/** What the status card says right now. */
async function statusOf(page: Page, token: string) {
  await page.goto(`/p/${token}`);
  const card = page.locator("section.status");
  await card.waitFor();
  const button = card.getByRole("link");
  return {
    chip: (await card.locator(".chip").innerText()).trim(),
    headline: (await card.getByRole("heading", { level: 2 }).innerText()).trim(),
    action: (await button.count()) > 0 ? (await button.first().innerText()).trim() : null,
    hasEdge: await card.evaluate((el) => el.classList.contains("status-act")),
    body: await card.innerText(),
  };
}

test.afterAll(async () => {
  await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
  await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
  await closeDb();
});

test("the home page tells the truth at every stage, as the team moves the project", async ({ page }) => {
  const { token, projectId } = await freshLink(SEED_SLUG);
  await backToBuilding(projectId);
  await signInClient(page, token, projectId);

  // Stage 2, the agreement, with it sitting on our side.
  await setPhase(projectId, "AGREEMENT_DRAFT");
  await query("UPDATE Project SET expectedBy = NULL WHERE id = ?", [projectId]);
  let s = await statusOf(page, token);
  expect(s.chip).toBe("Nothing needed from you");
  expect(s.headline).toBe("We are writing your agreement");
  expect(s.action, "nothing to do means no button").toBeNull();
  expect(s.hasEdge, "the accent edge is only for action needed").toBe(false);
  expect(s.body, "with no date, it says how we will reach them").toMatch(/we will (message|email) you/i);

  // A date the team promised turns up in the client's own words, and only
  // after the team has set it: the page never invents one.
  await query("UPDATE Project SET expectedBy = DATE_ADD(NOW(3), INTERVAL 3 DAY) WHERE id = ?", [projectId]);
  s = await statusOf(page, token);
  expect(s.body).toMatch(/We expect to have it with you by \w{3} \d{1,2} \w{3} \d{4}\./);

  // A date that has passed is not a promise, it is a broken one, so it goes.
  await query("UPDATE Project SET expectedBy = DATE_SUB(NOW(3), INTERVAL 2 DAY) WHERE id = ?", [projectId]);
  s = await statusOf(page, token);
  expect(s.body, "a date in the past is dropped").not.toMatch(/We expect to have it with you by/);

  // Stage 2, sent. The one thing they can do, named.
  await setPhase(projectId, "AGREEMENT_SENT");
  s = await statusOf(page, token);
  expect(s.chip).toBe("Action needed");
  expect(s.headline).toBe("Read and agree to your plan");
  expect(s.action).toBe("Review agreement");
  expect(s.hasEdge).toBe(true);

  // Stage 3, the build.
  await setPhase(projectId, "AGREED");
  s = await statusOf(page, token);
  expect(s.chip).toBe("Nothing needed from you");
  expect(s.headline).toBe("Agreed, thank you");

  await setPhase(projectId, "BUILDING");
  s = await statusOf(page, token);
  expect(s.headline).toBe("We are building it");
  expect(s.action).toBeNull();

  // Stage 4, the delivery, opened from the admin side for real.
  const admin = await page.context().newPage();
  await signInAdmin(admin);
  await admin.goto(`/admin/projects/${projectId}`);
  await admin.getByLabel(/where they can see the finished work/i).fill("https://staging.example/finished");
  await admin.getByRole("button", { name: /mark it ready/i }).click();
  await expect(admin.getByText(/round 1/i).first()).toBeVisible();

  s = await statusOf(page, token);
  expect(s.chip).toBe("Action needed");
  expect(s.headline).toBe("Check the finished work");
  expect(s.action).toBe("Review delivery");

  // The client sends it back, which is the one round-trip in the whole job.
  await page.goto(`/p/${token}/review`);
  await page.getByLabel(/anything that is off/i).fill("The returns label is the wrong size.");
  await page.getByRole("button", { name: /send this back to us/i }).click();
  // Wait for the write, not for a URL: the action lands the client back on a
  // /p/ page either way, so matching the URL would pass before it had run.
  await expect
    .poll(async () => {
      const rows = await query<{ outcome: string }>(
        "SELECT outcome FROM ReviewRound WHERE projectId = ? ORDER BY roundNumber DESC LIMIT 1",
        [projectId],
      );
      return rows[0]?.outcome;
    })
    .toBe("CHANGES_REQUESTED");

  s = await statusOf(page, token);
  expect(s.chip).toBe("Nothing needed from you");
  expect(s.headline).toBe("We are making the changes you asked for");
  expect(s.action).toBeNull();

  // Stage 5, the check-in, from a signed-off delivery.
  await query("UPDATE ReviewRound SET outcome = 'ACCEPTED' WHERE projectId = ?", [projectId]);
  await setPhase(projectId, "DELIVERED");
  await query("UPDATE Project SET deliveredAt = NOW(3), thanksSeenAt = NOW(3) WHERE id = ?", [projectId]);
  await query(
    "INSERT INTO Day30 (id, projectId, unlocksAt, frictionNotes) VALUES (?, ?, DATE_ADD(NOW(3), INTERVAL 20 DAY), '')",
    [`d30home${Date.now()}`, projectId],
  );
  s = await statusOf(page, token);
  expect(s.chip).toBe("Nothing needed from you");
  expect(s.headline).toBe("One last thing, a month from now");
  expect(s.body, "the date the check-in opens is a real one").toMatch(/It opens on this page on \w{3} \d{1,2} \w{3} \d{4}\./);

  await query("UPDATE Day30 SET unlocksAt = DATE_SUB(NOW(3), INTERVAL 1 DAY) WHERE projectId = ?", [projectId]);
  s = await statusOf(page, token);
  expect(s.chip).toBe("Action needed");
  expect(s.headline).toBe("A quick month-on check-in");
  expect(s.action).toBe("Open the check-in");

  await query("UPDATE Day30 SET metricAfterValue = '18 a week', metricAfterSubmittedAt = NOW(3) WHERE projectId = ?", [projectId]);
  s = await statusOf(page, token);
  expect(s.chip).toBe("Done");
  expect(s.headline).toBe("That is everything, thank you");
  expect(s.action).toBeNull();

  await admin.close();
  await backToBuilding(projectId);
});

test("the rail says where they are, in three states told apart by more than colour", async ({ page }) => {
  const { token, projectId } = await freshLink(SEED_SLUG);
  await backToBuilding(projectId);
  await signInClient(page, token, projectId);
  await page.goto(`/p/${token}`);

  const rail = page.getByRole("navigation", { name: "Project progress" });
  await expect(rail).toBeVisible();
  await expect(rail.getByText("Step 3 of 5")).toBeVisible();

  // The current stage is the one the card is talking about, and it is the only
  // one carrying aria-current.
  const current = rail.getByRole("button", { name: /where you are now/i });
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute("aria-current", "step");
  await expect(current).toContainText("Build");

  // Done and still-to-come are said in words, not only in colour.
  await expect(rail.getByRole("button", { name: /questionnaire\s*,\s*done/i })).toBeVisible();
  await expect(rail.getByRole("button", { name: /delivery\s*,\s*still to come/i })).toBeVisible();

  // Opening a stage says what happens in it and how long it takes.
  const note = page.locator("#rail-note");
  await expect(note).toBeHidden();
  await rail.getByRole("button", { name: /delivery\s*,\s*still to come/i }).click();
  await expect(note).toBeVisible();
  await expect(note).toContainText("You check the finished work");
  await expect(note).toContainText("A day or two");

  // Opening the one they are on takes them to the answer instead.
  await current.click();
  await expect(page.locator("section.status")).toBeInViewport();
});

test("the page has a floor, one primary action, and no sideways scroll", async ({ page }) => {
  const { token, projectId } = await freshLink(SEED_SLUG);
  await backToBuilding(projectId);
  await setPhase(projectId, "AGREEMENT_SENT");
  await signInClient(page, token, projectId);
  await page.goto(`/p/${token}`);

  const size = page.viewportSize();
  // The footer sits at the bottom of the window even on a short page.
  const foot = await page.locator(".p-foot").boundingBox();
  const shell = await page.locator(".p-shell").boundingBox();
  expect(shell!.height, "the frame fills the window").toBeGreaterThanOrEqual((size?.height ?? 0) - 1);
  expect(foot!.y + foot!.height, "the footer is the last thing in it").toBeGreaterThan(shell!.height - 2);

  // One filled action in the page body, and one in the bar. Nothing else
  // competes with them.
  await expect(page.locator(".p-body .btn-primary")).toHaveCount(1);
  await expect(page.locator("header .p-cta")).toHaveCount(1);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await backToBuilding(projectId);
});

test("dark by default, and one button on the bar turns it to paper", async ({ page, context }) => {
  const { token, projectId } = await freshLink(SEED_SLUG);
  await backToBuilding(projectId);
  await signInClient(page, token, projectId);
  // No choice made yet. Dark is the brand, not whatever the device prefers.
  await context.clearCookies({ name: "awtm_theme" });
  await page.goto(`/p/${token}`);

  const theme = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  const ground = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ground").trim());
  expect(await theme(), "dark with nothing chosen").toBe("dark");
  const dark = await ground();

  // The control is on the bar beside the menu, not inside it, and it says
  // what it will do rather than what is already true.
  const toggle = page.getByRole("banner").getByRole("button", { name: /switch to the light theme/i });
  await expect(toggle).toBeVisible();
  await toggle.click();
  expect(await theme()).toBe("light");
  expect(await ground(), "the two themes are not the same colour").not.toBe(dark);

  await page.reload();
  expect(await theme(), "the choice is a cookie, so it survives a reload").toBe("light");

  await page.getByRole("banner").getByRole("button", { name: /switch to the dark theme/i }).click();
  expect(await theme()).toBe("dark");
  expect(await ground()).toBe(dark);
});

test("the team gets the same switch, in the same two states", async ({ page, context }) => {
  await signInAdmin(page);
  await context.clearCookies({ name: "awtm_theme" });
  await page.goto("/admin");

  const theme = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  expect(await theme(), "dark with nothing chosen").toBe("dark");

  await page.getByRole("button", { name: /switch to the light theme/i }).click();
  expect(await theme()).toBe("light");
  // The sidebar reads on paper too: its ink and its ground are not the same.
  const readable = await page.evaluate(() => {
    const side = document.querySelector(".a-side");
    if (!side) return false;
    const style = getComputedStyle(side);
    return style.backgroundColor !== style.color;
  });
  expect(readable).toBe(true);

  await page.reload();
  expect(await theme()).toBe("light");
  await page.getByRole("button", { name: /switch to the dark theme/i }).click();
  expect(await theme()).toBe("dark");
});
