import { expect, test } from "@playwright/test";
import { agreementSecrets, closeDb, freshLink, resetRateLimits, SEED_SLUG, takeoverLatestCode } from "./fixtures";

test.afterAll(async () => {
  await closeDb();
});

/**
 * Acceptance criterion 8 and CLAUDE.md section 2 rule 2. Requests every client
 * and print route for the seed project and asserts that no body carries an
 * internal amount or an internal note. ADR 0009 is what makes this pass; this
 * test is what proves it stays passing.
 */
test.describe("the leak walk", () => {
  test("no client or print route carries internal cost or internal notes", async ({ page, request }) => {
    await resetRateLimits();
    const { token, projectId } = await freshLink(SEED_SLUG);
    const secrets = await agreementSecrets(projectId);

    const forbidden = [
      secrets.costPaise,
      secrets.rupees,
      secrets.notes,
      "internalCost",
      "internalNotes",
    ].filter((s) => s.length > 3);

    // Sign in the way a client does.
    await page.goto(`/p/${token}`);
    await page.getByRole("button", { name: /send the code/i }).click();
    await expect(page.getByLabel(/six digit code/i)).toBeVisible();
    const code = await takeoverLatestCode(projectId, "LOGIN");
    await page.getByLabel(/six digit code/i).fill(code);
    await page.getByRole("button", { name: /^confirm$/i }).click();
    // "Your project" only renders once the session cookie is accepted.
    await expect(page.getByText(/your project/i)).toBeVisible();

    const cookies = await page.context().cookies();
    const header = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const routes = [
      `/p/${token}`,
      `/p/${token}/intake`,
      `/p/${token}/agreement`,
      `/agreement/${token}/print`,
      `/admin/projects/${projectId}/intake/answers.json`,
    ];

    for (const route of routes) {
      const response = await request.get(route, { headers: { cookie: header } });
      const body = await response.text();
      for (const secret of forbidden) {
        expect(body, `${route} leaked ${secret.slice(0, 24)}`).not.toContain(secret);
      }
    }
  });

  test("private zones send noindex and no-store, and robots disallows them", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    for (const prefix of ["/p/", "/admin/", "/invoice/", "/agreement/"]) {
      expect(robots).toContain(`Disallow: ${prefix}`);
    }
    for (const route of ["/p/anything", "/admin", "/agreement/anything/print"]) {
      const response = await request.get(route, { maxRedirects: 0 });
      expect(response.headers()["x-robots-tag"], route).toContain("noindex");
      expect(response.headers()["cache-control"], route).toContain("no-store");
    }
  });

  test("the marketing page is static and says nothing about stages", async ({ request }) => {
    const body = await (await request.get("/")).text();
    expect(body).toContain("The same loop, once.");
    expect(body).not.toContain("30 percent to begin");
    expect(body).not.toContain("Awaiting the facts");
  });
});
