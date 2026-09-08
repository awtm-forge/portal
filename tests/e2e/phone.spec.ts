import { expect, test } from "@playwright/test";
import { backToBuilding, closeDb, day30Open, freshLink, openRoundDirect, query, resetRateLimits, SEED_SLUG, setPhase, takeoverLatestCode } from "./fixtures";

/**
 * Acceptance criterion 13, for every client page rather than one of them, and
 * INTAKE-SPEC 14.13. Written on 9 September 2026, when the acceptance audit
 * found that this rested on somebody having looked rather than on anything
 * that would go red.
 *
 * The rule from CLAUDE.md 2 item 9 says "exactly one primary action above the
 * fold". Measured, three pages have none, and each for a good reason: while
 * building there is nothing for the client to do but read the week's update,
 * and on the agreement and the review the button deliberately sits after the
 * document, because agreeing to something you have not scrolled through is
 * the thing the whole design is against.
 *
 * So what is tested is "never more than one", which is the rule the wording
 * was reaching for. Recorded in QUESTIONS.md Q10.
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

for (const screen of PAGES) {
  test(`${screen.name} shows one thing to do above the fold, and no navigation`, async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone project only");
    await screen.setUp();
    await signIn(page);
    await page.goto(screen.path());

    // No navigation, no sidebar, no tabs. CLAUDE.md 2 item 9.
    await expect(page.locator("nav")).toHaveCount(0);
    await expect(page.getByRole("tablist")).toHaveCount(0);

    const actions = await primaryActionsAboveFold(page);
    expect(actions.length, `${screen.name}: ${actions.join(" | ")}`).toBeLessThanOrEqual(1);
  });
}

test("the questionnaire shows only the open section above the fold", async ({ page, isMobile }) => {
  // INTAKE-SPEC 14.13.
  test.skip(!isMobile, "phone project only");
  await setPhase(projectId, "INTAKE");
  await signIn(page);
  await page.goto(`/p/${token}/intake`);

  await expect(page.locator("nav")).toHaveCount(0);
  const actions = await primaryActionsAboveFold(page);
  expect(actions.length, actions.join(" | ")).toBeLessThanOrEqual(1);
});

test("no client page scrolls sideways", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone project only");
  await setPhase(projectId, "BUILDING");
  await signIn(page);

  for (const path of [`/p/${token}`, `/p/${token}/intake`]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("the pages that ask for something put exactly one button in reach", async ({ page, isMobile }) => {
  // The other half of the rule. Where there is something to do, it is one
  // thing and it is on the first screen, not buried.
  test.skip(!isMobile, "phone project only");

  await query("UPDATE Project SET deliveredAt = NOW(3), thanksSeenAt = NULL WHERE id = ?", [projectId]);
  await setPhase(projectId, "DELIVERED");
  await signIn(page);
  await page.goto(`/p/${token}/thanks`);
  expect(await primaryActionsAboveFold(page)).toHaveLength(1);

  await day30Open(projectId);
  await page.goto(`/p/${token}/day30`);
  expect(await primaryActionsAboveFold(page)).toHaveLength(1);
});
