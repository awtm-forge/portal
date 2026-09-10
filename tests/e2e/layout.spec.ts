import { expect, test } from "@playwright/test";
import { backToBuilding, closeDb, day30Open, freshLink, INTAKE_SLUG, openRoundDirect, query, resetRateLimits, SEED_SLUG, setPhase, takeoverLatestCode } from "./fixtures";

/**
 * Acceptance criterion 13 and INTAKE-SPEC 14.13, on every client page and at
 * every width the suite runs.
 *
 * Two things about the criterion turned out to be wrong when it was measured
 * rather than assumed, and both are recorded in QUESTIONS.md.
 *
 * Q10: it says "exactly one primary action above the fold", and three pages
 * have none. While building there is nothing for the client to do but read
 * the week's update, and on the agreement and the review the button sits
 * after the document on purpose, because agreeing to something you have not
 * scrolled through is what the whole design is against. So the rule tested is
 * "never more than one", plus "exactly one where the page asks for something".
 *
 * Q11: it says "on a 375px screen", and Rahul said on 9 September that people
 * use this on the web. These run on the desktop project too now. The rule is
 * about attention, not viewport, so it should hold at any width, and a rule
 * that only holds at one width was never really the rule.
 */
let projectId = "";
let token = "";

test.afterAll(async () => {
  await backToBuilding(projectId);
  await closeDb();
});

test.beforeEach(async () => {
  await resetRateLimits();
  const link = await freshLink(SEED_SLUG);
  projectId = link.projectId;
  token = link.token;
  // Whatever an earlier spec left. A stale day-30 row puts a second loud
  // button on the project page and the rule looks broken when it is not.
  await query("DELETE FROM Day30 WHERE projectId = ?", [projectId]);
  await query("UPDATE Project SET deliveredAt = NULL, thanksSeenAt = NULL WHERE id = ?", [projectId]);
});

async function signIn(page: import("@playwright/test").Page) {
  await page.goto(`/p/${token}`);
  await page.getByRole("button", { name: /email me a code/i }).click();
  await expect(page.getByLabel(/six digit code/i)).toBeVisible();
  await page.getByLabel(/six digit code/i).fill(await takeoverLatestCode(projectId, "LOGIN"));
  await page.getByRole("button", { name: /open my page/i }).click();
  await expect(page.getByText("Your project", { exact: true })).toBeVisible();
}

/**
 * The loud actions whose top edge is on the first screen.
 *
 * "Primary" is `.btn-full` without `.ghost`, which is the one filled button
 * the design gives each screen. A collapsed `<details>` summary is not a
 * thing to do, it is the record folded away, and a quiet `link-mono` is an
 * escape hatch like Skip. Counting those would be measuring the wrong rule:
 * the client should have one obvious next move, not one clickable element.
 */
async function primaryActionsAboveFold(page: import("@playwright/test").Page): Promise<string[]> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("no viewport");
  const controls = page.locator(".btn-full:not(.ghost)");
  const found: string[] = [];
  for (let i = 0; i < (await controls.count()); i++) {
    const control = controls.nth(i);
    if (!(await control.isVisible())) continue;
    const box = await control.boundingBox();
    if (box && box.y < viewport.height) found.push(((await control.innerText()) || "(no text)").trim().slice(0, 40));
  }
  return found;
}

const PAGES: { name: string; setUp: () => Promise<void>; path: () => string }[] = [
  {
    name: "the project page while building",
    setUp: async () => { await setPhase(projectId, "BUILDING"); },
    path: () => `/p/${token}`,
  },
  {
    name: "the agreement",
    setUp: async () => { await setPhase(projectId, "AGREEMENT_SENT"); },
    path: () => `/p/${token}/agreement`,
  },
  {
    name: "the review",
    setUp: async () => { await backToBuilding(projectId); await openRoundDirect(projectId); await setPhase(projectId, "IN_REVIEW"); },
    path: () => `/p/${token}/review`,
  },
  {
    name: "the thank-you page",
    setUp: async () => {
      await query("UPDATE Project SET deliveredAt = NOW(3), thanksSeenAt = NULL WHERE id = ?", [projectId]);
      await setPhase(projectId, "DELIVERED");
    },
    path: () => `/p/${token}/thanks`,
  },
  {
    name: "day 30",
    setUp: async () => { await day30Open(projectId); },
    path: () => `/p/${token}/day30`,
  },
];

/**
 * Q15, 10 September: Ayush asked for a way between the client's pages and
 * one control to reach the team, on every page. So a `nav` exists now, and
 * the rule tested is that it is quiet: text links only, never a filled
 * button, and no tabs. The one loud action stays in the body.
 */
async function navigationIsQuiet(page: import("@playwright/test").Page) {
  await expect(page.locator("nav .btn-full")).toHaveCount(0);
  await expect(page.locator("nav")).toHaveCount(1);
  await expect(page.getByRole("tablist")).toHaveCount(0);
  await expect(page.locator(".reach summary")).toHaveText("Reach us");
}

for (const screen of PAGES) {
  test(`${screen.name} shows one thing to do above the fold, and only quiet navigation`, async ({ page }) => {
    await screen.setUp();
    await signIn(page);
    await page.goto(screen.path());

    // One column, no sidebar, no tabs; a quiet row of links (Q15). CLAUDE.md 2 item 9.
    await navigationIsQuiet(page);

    const actions = await primaryActionsAboveFold(page);
    expect(actions.length, `${screen.name}: ${actions.join(" | ")}`).toBeLessThanOrEqual(1);
  });
}

test("the questionnaire shows only the open section above the fold", async ({ page }) => {
  // INTAKE-SPEC 14.13.
  await setPhase(projectId, "INTAKE");
  await signIn(page);
  await page.goto(`/p/${token}/intake`);

  await navigationIsQuiet(page);
  const actions = await primaryActionsAboveFold(page);
  expect(actions.length, actions.join(" | ")).toBeLessThanOrEqual(1);
});

test("no client page scrolls sideways", async ({ page }) => {
  await setPhase(projectId, "BUILDING");
  await signIn(page);

  for (const path of [`/p/${token}`, `/p/${token}/intake`]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("the pages that ask for something put exactly one button in reach", async ({ page }) => {
  // The other half of the rule. Where there is something to do, it is one
  // thing and it is on the first screen, not buried.

  await query("UPDATE Project SET deliveredAt = NOW(3), thanksSeenAt = NULL WHERE id = ?", [projectId]);
  await setPhase(projectId, "DELIVERED");
  await signIn(page);
  await page.goto(`/p/${token}/thanks`);
  expect(await primaryActionsAboveFold(page)).toHaveLength(1);

  await day30Open(projectId);
  await page.goto(`/p/${token}/day30`);
  expect(await primaryActionsAboveFold(page)).toHaveLength(1);
});

test("an answer survives closing the tab and opening the link on another device", async ({ browser }) => {
  // INTAKE-SPEC 14.1. Uses the project whose questionnaire is still open: the
  // seed one has been submitted, and a submitted questionnaire renders its
  // answers read-only, which is a different screen.
  const own = await freshLink(INTAKE_SLUG);
  await resetRateLimits();

  const firstDevice = await browser.newContext();
  const firstPage = await firstDevice.newPage();
  await firstPage.goto(`/p/${own.token}`);
  await firstPage.getByRole("button", { name: /email me a code/i }).click();
  await expect(firstPage.getByLabel(/six digit code/i)).toBeVisible();
  await firstPage.getByLabel(/six digit code/i).fill(await takeoverLatestCode(own.projectId, "LOGIN"));
  await firstPage.getByRole("button", { name: /open my page/i }).click();
  await expect(firstPage.getByText("Your project", { exact: true })).toBeVisible();

  await firstPage.goto(`/p/${own.token}/intake`);
  // Open a named section on both devices. The renderer opens the first
  // unfinished one, which is not the same section on a fresh device, and the
  // test would then be comparing two different questions.
  await firstPage.getByRole("button", { name: /your business/i }).click();
  const before = await firstPage.locator('input[type="text"]').first().inputValue();
  const typed = `Zzyxth ${Date.now()}, appliances and white goods.`;
  const field = firstPage.locator('textarea, input[type="text"]').first();
  await expect(field).toBeVisible();
  await field.fill(typed);
  await field.blur();

  // Saving happens on its own; wait for it rather than assuming a delay.
  await expect
    .poll(async () => {
      const rows = await query<{ answers: unknown }>("SELECT answers FROM Intake WHERE clientId = ?", [own.clientId]);
      // The driver parses a JSON column, so stringify it back to search it.
      return JSON.stringify(rows[0]?.answers ?? "");
    }, { timeout: 10000 })
    .toContain(typed);
  await firstDevice.close();

  // A different device: a fresh cookie jar, so it asks for a code again
  // (PORTAL-SPEC 5.10) and then shows what was typed on the first one.
  await resetRateLimits();
  const secondDevice = await browser.newContext();
  const secondPage = await secondDevice.newPage();
  await secondPage.goto(`/p/${own.token}`);
  await secondPage.getByRole("button", { name: /email me a code/i }).click();
  await expect(secondPage.getByLabel(/six digit code/i)).toBeVisible();
  await secondPage.getByLabel(/six digit code/i).fill(await takeoverLatestCode(own.projectId, "LOGIN"));
  await secondPage.getByRole("button", { name: /open my page/i }).click();
  await expect(secondPage.getByText("Your project", { exact: true })).toBeVisible();

  await secondPage.goto(`/p/${own.token}/intake`);
  // One section is open at a time, so a finished one has to be reopened before
  // its answers are on the page at all. That is the design, not a bug.
  await secondPage.getByRole("button", { name: /your business/i }).click();
  await expect(secondPage.locator('input[type="text"]').first()).toHaveValue(typed);
  await secondDevice.close();

  // Put the demo answer back, so the seed project reads as it was written.
  const firstAgain = await browser.newContext();
  const restorePage = await firstAgain.newPage();
  await resetRateLimits();
  await restorePage.goto(`/p/${own.token}`);
  await restorePage.getByRole("button", { name: /email me a code/i }).click();
  await expect(restorePage.getByLabel(/six digit code/i)).toBeVisible();
  await restorePage.getByLabel(/six digit code/i).fill(await takeoverLatestCode(own.projectId, "LOGIN"));
  await restorePage.getByRole("button", { name: /open my page/i }).click();
  await expect(restorePage.getByText("Your project", { exact: true })).toBeVisible();
  await restorePage.goto(`/p/${own.token}/intake`);
  await restorePage.getByRole("button", { name: /your business/i }).click();
  const restore = restorePage.locator('input[type="text"]').first();
  await restore.fill(before);
  await restore.blur();
  await expect
    .poll(async () => {
      const rows = await query<{ answers: unknown }>("SELECT answers FROM Intake WHERE clientId = ?", [own.clientId]);
      return JSON.stringify(rows[0]?.answers ?? "");
    }, { timeout: 10000 })
    .not.toContain(typed);
  await firstAgain.close();
});
