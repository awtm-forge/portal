import { expect, test } from "@playwright/test";
import { closeDb, freshLink, query, resetRateLimits, SEED_SLUG, setPhase, takeoverLatestCode } from "./fixtures";

/**
 * Q15. On every client page: a row of links to the pages that exist for
 * them, the current one marked, and one "Reach us" control with the team's
 * email and, when a phone is in Settings, WhatsApp. The row lists only what
 * is there: no agreement link before an agreement has been sent.
 */
let projectId = "";
let token = "";
let phaseBefore = "";

test.beforeEach(async ({ page }) => {
  await resetRateLimits();
  const link = await freshLink(SEED_SLUG);
  projectId = link.projectId;
  token = link.token;
  phaseBefore = (await query<{ phase: string }>("SELECT phase FROM Project WHERE id = ?", [projectId]))[0]?.phase ?? "BUILDING";
  await page.goto(`/p/${token}`);
  await page.getByRole("button", { name: /email me a code/i }).click();
  await expect(page.getByLabel(/six digit code/i)).toBeVisible();
  await page.getByLabel(/six digit code/i).fill(await takeoverLatestCode(projectId, "LOGIN"));
  await page.getByRole("button", { name: /open my page/i }).click();
  await expect(page.getByRole("main").getByText("Your project", { exact: true })).toBeVisible();
});

test.afterEach(async () => {
  await setPhase(projectId, phaseBefore);
});

test.afterAll(async () => {
  await closeDb();
});

/**
 * The pages a client can reach, wherever they are at this width. Above 900 px
 * they are plain text links on the bar; below it the bar hides them and the
 * same labels sit behind the menu button (13 Sep). The tests run at both, so
 * they ask for whichever is real rather than assuming one.
 */
async function pageLinks(page: import("@playwright/test").Page) {
  const bar = page.locator(".p-links");
  if (await bar.isVisible()) return bar;
  await page.getByRole("button", { name: /menu/i }).click();
  const inMenu = page.locator("#portal-menu .pmenu-pages");
  await expect(inMenu).toBeVisible();
  return inMenu;
}

test("the menu lists the pages that exist, marks the current one, and each link goes there", async ({ page }) => {
  await setPhase(projectId, "BUILDING");
  // Other specs raise and remove the seed project's invoices, so the row is
  // checked against what is there rather than against the seed as written.
  const invoiceCount = Number((await query<{ n: number | bigint }>("SELECT COUNT(*) AS n FROM Invoice WHERE projectId = ?", [projectId]))[0]?.n ?? 0);
  await page.goto(`/p/${token}`);
  let nav = await pageLinks(page);
  // In the menu the page you are on carries a "You are here" note beside it.
  await expect(nav.getByRole("link")).toHaveText([/^Your project/, "Questionnaire", "Agreement", ...(invoiceCount > 0 ? ["Invoices"] : [])]);
  await expect(nav.getByRole("link", { name: "Your project" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Delivery" })).toHaveCount(0);

  await nav.getByRole("link", { name: "Agreement" }).click();
  await expect(page).toHaveURL(new RegExp(`/p/${token}/agreement$`));
  nav = await pageLinks(page);
  await expect(nav.getByRole("link", { name: "Agreement" })).toHaveAttribute("aria-current", "page");

  if (invoiceCount > 0) {
    nav = await pageLinks(page);
    await nav.getByRole("link", { name: "Invoices" }).click();
    await expect(page).toHaveURL(new RegExp(`/p/${token}/invoices$`));
    await expect(page.getByRole("heading", { name: /your invoice/i })).toBeVisible();
    await expect(page.locator(".inv-row").first()).toBeVisible();
  } else {
    await page.goto(`/p/${token}/invoices`);
    await expect(page.getByText(/Nothing yet/)).toBeVisible();
  }

  // The wordmark goes home too.
  await page.getByRole("link", { name: /awtm forge/i }).click();
  await expect(page).toHaveURL(new RegExp(`/p/${token}$`));
});

test("the delivery page appears in the navigation only while a review is open", async ({ page }) => {
  await setPhase(projectId, "IN_REVIEW");
  await query("DELETE FROM ReviewRound WHERE projectId = ? AND outcome = 'OPEN' AND id LIKE 'nav%'", [projectId]);
  await query(
    "INSERT INTO ReviewRound (id, projectId, roundNumber, sentAt, finishedWorkUrl, outcome) VALUES (?, ?, (SELECT COALESCE(MAX(r.roundNumber), 0) + 1 FROM (SELECT roundNumber FROM ReviewRound WHERE projectId = ?) r), NOW(3), 'https://staging.example/finished', 'OPEN')",
    [`nav${Date.now()}`, projectId, projectId],
  );
  await page.goto(`/p/${token}`);
  const nav = await pageLinks(page);
  await expect(nav.getByRole("link", { name: "Delivery" })).toBeVisible();
  await query("DELETE FROM ReviewRound WHERE projectId = ? AND id LIKE 'nav%'", [projectId]);
});

test("the ways to reach a person are in the menu on every page", async ({ page }) => {
  const email = (await query<{ email: string }>("SELECT email FROM Company LIMIT 1"))[0]?.email ?? "hello@awtmforge.com";
  const phone = (await query<{ phone: string }>("SELECT phone FROM Company LIMIT 1"))[0]?.phone ?? "";
  for (const path of [`/p/${token}`, `/p/${token}/intake`, `/p/${token}/agreement`]) {
    await page.goto(path);
    await page.getByRole("button", { name: /menu/i }).click();
    const menu = page.locator(".pmenu-panel");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: `Email ${email}` })).toHaveAttribute("href", `mailto:${email}`);
    if (phone.trim()) {
      await expect(menu.getByRole("link", { name: "WhatsApp Rahul" })).toHaveAttribute("href", /wa\.me\/\d+/);
    } else {
      await expect(menu.getByRole("link", { name: "WhatsApp Rahul" })).toHaveCount(0);
    }
  }
});

test("the menu is not there before signing in, and nothing in it is a loud button", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto(`/p/${token}`);
  // Nothing to navigate to until they are in: no menu, and no pages listed.
  await expect(page.getByRole("button", { name: /menu/i })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Your pages" })).toHaveCount(0);
  await expect(page.locator(".p-links, .pmenu-pages")).toHaveCount(0);
});
