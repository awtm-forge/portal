import { expect, test } from "@playwright/test";
import { closeDb, freshLink, INTAKE_SLUG, query, resetRateLimits, takeoverLatestCode } from "./fixtures";

/**
 * INTAKE-SPEC 11: one section open at a time, one button at the bottom of it.
 * On 10 September a client on production could not find the way back to a
 * section they had already carried on from, because the only way was tapping
 * its title, which nothing said. There is a quiet Back under the button now
 * (Q13). It is not a primary action, so criterion 13 still counts one.
 */
let projectId = "";
let clientId = "";
let token = "";
let sectionsDoneBefore = "[]";

test.beforeEach(async ({ page }) => {
  await resetRateLimits();
  const link = await freshLink(INTAKE_SLUG);
  projectId = link.projectId;
  clientId = link.clientId;
  token = link.token;
  const rows = await query<{ sectionsDone: unknown }>("SELECT sectionsDone FROM Intake WHERE clientId = ?", [clientId]);
  sectionsDoneBefore = JSON.stringify(rows[0]?.sectionsDone ?? []);

  await page.goto(`/p/${token}`);
  await page.getByRole("button", { name: /email me a code/i }).click();
  await expect(page.getByLabel(/six digit code/i)).toBeVisible();
  await page.getByLabel(/six digit code/i).fill(await takeoverLatestCode(projectId, "LOGIN"));
  await page.getByRole("button", { name: /open my page/i }).click();
  await expect(page.getByText("Your project", { exact: true })).toBeVisible();
});

test.afterEach(async () => {
  // Carrying on marks a section done; put the seed back as it was written.
  await query("UPDATE Intake SET sectionsDone = ? WHERE clientId = ?", [sectionsDoneBefore, clientId]);
});

test.afterAll(async () => {
  await closeDb();
});

test("the client can go back a section, and the first section has no back", async ({ page }) => {
  await page.goto(`/p/${token}/intake`);
  await page.getByRole("button", { name: /your business/i }).click();
  await expect(page.locator(".card.now .sec-name")).toHaveText("Your business");
  await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Save and carry on" }).click();
  await expect(page.locator(".card.now .sec-name")).toHaveText("What is going wrong, and what you are running on");

  // Still one loud button on the page: Back is the quiet kind.
  await expect(page.locator(".btn-full:not(.ghost)")).toHaveCount(1);

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.locator(".card.now .sec-name")).toHaveText("Your business");
  // The section they carried on from is still marked done, and still ahead.
  await expect(page.locator(".card").nth(1).locator(".tag")).toHaveText("Later");
  await expect(page.locator(".card").nth(0).locator(".tag")).toHaveText("Now");
  await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
});
