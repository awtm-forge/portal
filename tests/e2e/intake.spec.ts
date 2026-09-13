import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { closeDb, freshLink, INTAKE_SLUG, query, resetRateLimits, SEED_SLUG, takeoverLatestCode } from "./fixtures";

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
  await expect(page.getByRole("main").getByText("Your project", { exact: true })).toBeVisible();
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

/**
 * ADR 0016 (Q14). Once sent, the questionnaire is locked. The client asks
 * for a change in a line; the team opens it; the client changes an answer
 * and sends; that is version 2, and admin reads both. The seed project's
 * questionnaire is the sent one, so these use it and put it back.
 */
test.describe("after sending, the questionnaire is locked", () => {
  const ADMIN_EMAIL = "e2e-changes@example.invalid";
  let seedProject = "";
  let seedClient = "";
  let seedToken = "";
  let answersBefore = "";

  async function cleanChanges() {
    await query("DELETE FROM IntakeChangeRequest WHERE clientId = ?", [seedClient]);
    await query("DELETE FROM IntakeVersion WHERE clientId = ? AND version > 1", [seedClient]);
  }

  async function signInAsClient(page: import("@playwright/test").Page) {
    await page.goto(`/p/${seedToken}`);
    await page.getByRole("button", { name: /email me a code/i }).click();
    await expect(page.getByLabel(/six digit code/i)).toBeVisible();
    await page.getByLabel(/six digit code/i).fill(await takeoverLatestCode(seedProject, "LOGIN"));
    await page.getByRole("button", { name: /open my page/i }).click();
    await expect(page.getByRole("main").getByText("Your project", { exact: true })).toBeVisible();
  }

  async function signInAsAdmin(page: import("@playwright/test").Page) {
    const token = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token).digest("hex");
    await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
    await query("UPDATE IntakeChangeRequest SET decidedById = NULL WHERE decidedById IN (SELECT id FROM AdminUser WHERE email = ?)", [ADMIN_EMAIL]);
    await query("DELETE FROM AdminUser WHERE email = ?", [ADMIN_EMAIL]);
    await query(
      "INSERT INTO AdminUser (id, email, name, passwordHash, setupTokenHash, setupExpiresAt, createdAt) VALUES (?, ?, ?, NULL, ?, ?, NOW(3))",
      [`e2ec${Date.now()}`, ADMIN_EMAIL, "End to end", hash, new Date(Date.now() + 3600_000)],
    );
    await page.goto(`/admin/setup/${token}`);
    await page.getByLabel(/^password/i).fill("a-long-enough-passphrase");
    await page.getByLabel(/again/i).fill("a-long-enough-passphrase");
    await page.getByRole("button", { name: /set it and sign in/i }).click();
    await expect(page.getByRole("heading", { name: /^projects$/i })).toBeVisible();
  }

  test.beforeEach(async () => {
    await resetRateLimits();
    const link = await freshLink(SEED_SLUG);
    seedProject = link.projectId;
    seedClient = link.clientId;
    seedToken = link.token;
    const rows = await query<{ answers: unknown }>("SELECT answers FROM Intake WHERE clientId = ?", [seedClient]);
    answersBefore = JSON.stringify(rows[0]?.answers ?? {});
    await cleanChanges();
  });

  test.afterEach(async () => {
    await query("UPDATE Intake SET answers = ? WHERE clientId = ?", [answersBefore, seedClient]);
    await cleanChanges();
  });

  test("the client reads it back, asks in a line, and sends the change once it is opened", async ({ page }) => {
    await signInAsClient(page);
    await page.goto(`/p/${seedToken}/intake`);
    await expect(page.getByRole("heading", { name: "Your answers" })).toBeVisible();
    await expect(page.getByText(/It is locked now/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save and carry on" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Home textiles/ })).toHaveCount(0);
    // No dead placeholders on a locked page (F-07), and the ask is in view at
    // the top, not folded and not at the foot (F-08).
    await expect(page.getByText(/tap to add/i)).toHaveCount(0);
    await expect(page.getByLabel(/what needs changing/i)).toBeVisible();

    await page.getByLabel(/what needs changing/i).fill("The platform is WooCommerce, not Shopify.");
    await page.getByRole("button", { name: "Request a change" }).click();
    await expect(page.getByText(/You asked on .* to change something/)).toBeVisible();
    await expect(page.getByLabel(/what needs changing/i)).toHaveCount(0);
    const asked = await query<{ status: string; note: string }>("SELECT status, note FROM IntakeChangeRequest WHERE clientId = ?", [seedClient]);
    expect(asked).toEqual([{ status: "ASKED", note: "The platform is WooCommerce, not Shopify." }]);

    // The team opens it. The admin side is the next test; here it is the row.
    await query("UPDATE IntakeChangeRequest SET status = 'OPEN', decidedAt = NOW(3) WHERE clientId = ?", [seedClient]);
    await page.reload();
    await expect(page.getByText(/Open for changes/)).toBeVisible();
    await expect(page.locator(".btn-full:not(.ghost)")).toHaveCount(1);
    await page.getByRole("button", { name: /Home textiles/ }).click();
    const field = page.locator('input[type="text"]').first();
    await field.fill("Home textiles, small furniture, and rugs.");
    await field.blur();
    await expect
      .poll(async () => JSON.stringify((await query<{ answers: unknown }>("SELECT answers FROM Intake WHERE clientId = ?", [seedClient]))[0]?.answers ?? ""), { timeout: 10000 })
      .toContain("and rugs");
    await page.getByRole("button", { name: "Done with this answer" }).click();
    await page.getByRole("button", { name: "Send the changes" }).click();
    await expect(page.getByText(/It is locked now/)).toBeVisible();
    await expect(page.getByText(/Changes sent/)).toBeVisible();

    const versions = await query<{ version: number; sentBy: string; answers: unknown }>("SELECT version, sentBy, answers FROM IntakeVersion WHERE clientId = ? ORDER BY version", [seedClient]);
    expect(versions.map((v) => [v.version, v.sentBy])).toEqual([[1, "CLIENT"], [2, "CLIENT"]]);
    expect(JSON.stringify(versions[1].answers)).toContain("and rugs");
    expect(JSON.stringify(versions[0].answers)).not.toContain("and rugs");
    const closed = await query<{ status: string; version: number }>("SELECT status, version FROM IntakeChangeRequest WHERE clientId = ?", [seedClient]);
    expect(closed).toEqual([{ status: "SENT", version: 2 }]);
  });

  test("the team opens it from the client page, reads the versions, and can lock it again", async ({ page }) => {
    await query(
      "INSERT INTO IntakeChangeRequest (id, clientId, status, note, askedBy, askedAt) VALUES (?, ?, 'ASKED', 'The sign-off email is wrong.', 'CLIENT', NOW(3))",
      [`cr${Date.now()}`, seedClient],
    );
    await signInAsAdmin(page);
    await page.goto(`/admin/clients/${seedClient}`);
    await expect(page.getByText(/they asked to change it/i)).toBeVisible();
    await expect(page.getByText(/The sign-off email is wrong/)).toBeVisible();
    await page.getByRole("button", { name: "Open it for them" }).click();
    await expect(page.getByText(/open for changes/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Tell them on WhatsApp/ })).toBeVisible();

    await page.getByRole("button", { name: "Lock it again" }).click();
    await expect(page.getByText(/version 2/i).first()).toBeVisible();
    const versions = await query<{ version: number; sentBy: string }>("SELECT version, sentBy FROM IntakeVersion WHERE clientId = ? ORDER BY version", [seedClient]);
    expect(versions.map((v) => [v.version, v.sentBy])).toEqual([[1, "CLIENT"], [2, "TEAM"]]);

    await page.goto(`/admin/clients/${seedClient}/intake`);
    await expect(page.getByText(/Version 2, current/)).toBeVisible();
    await page.getByRole("link", { name: /^Version 1$/ }).click();
    await expect(page.getByText(/reading version 1 of 2/)).toBeVisible();
    await expect(page.getByText(/The first sending/)).toBeVisible();
  });
});

