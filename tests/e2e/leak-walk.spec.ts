import { expect, test } from "@playwright/test";
import { agreementSecrets, closeDb, freshLink, query, resetRateLimits, SEED_SLUG, takeoverLatestCode } from "./fixtures";

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

    // Criteria 25 and 26: someone else's details, and words the client has not
    // approved, must not reach a client page, a print route or an export.
    const REFERRAL_NAME = "Zzyxth Referralperson";
    const REFERRAL_CONTACT = "zzyxth-referral@example.invalid";
    const DRAFT_QUOTE = "Zzyxth unapproved draft testimonial text";
    await query("DELETE FROM Referral WHERE projectId = ?", [projectId]);
    await query("DELETE FROM Testimonial WHERE projectId = ?", [projectId]);
    await query("INSERT INTO Referral (id, projectId, name, contact, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
      `leak${Date.now()}`, projectId, REFERRAL_NAME, REFERRAL_CONTACT,
    ]);
    await query(
      "INSERT INTO Testimonial (id, projectId, moment, text, status, createdAt, updatedAt) VALUES (?, ?, 'DELIVERY', ?, 'DRAFT', NOW(3), NOW(3))",
      [`leakt${Date.now()}`, projectId, DRAFT_QUOTE],
    );

    const forbidden = [
      secrets.costPaise,
      secrets.rupees,
      secrets.notes,
      "internalCost",
      "internalNotes",
      REFERRAL_NAME,
      REFERRAL_CONTACT,
      DRAFT_QUOTE,
    ].filter((s) => s.length > 3);

    // Sign in the way a client does.
    await page.goto(`/p/${token}`);
    await page.getByRole("button", { name: /email me a code/i }).click();
    await expect(page.getByLabel(/six digit code/i)).toBeVisible();
    const code = await takeoverLatestCode(projectId, "LOGIN");
    await page.getByLabel(/six digit code/i).fill(code);
    await page.getByRole("button", { name: /open my page/i }).click();
    // "Your project" only renders once the session cookie is accepted.
    await expect(page.getByText(/your project/i)).toBeVisible();

    // Every invoice on the project, printed. PORTAL-SPEC 6.7 says neither
    // printable route carries internal cost, so both are walked.
    const invoiceIds = await query<{ id: string }>("SELECT id FROM Invoice WHERE projectId = ?", [projectId]);
    const invoiceRoutes = invoiceIds.map((i) => `/invoice/${i.id}/print`);

    const cookies = await page.context().cookies();
    const header = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    const routes = [
      `/p/${token}`,
      `/p/${token}/intake`,
      `/p/${token}/agreement`,
      `/p/${token}/review`,
      `/p/${token}/thanks`,
      `/agreement/${token}/print`,
      ...invoiceRoutes,
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

  test("no WhatsApp message ever carries someone else's details", async ({ page }) => {
    // The sneakiest path out: a template author being helpful. Every wa.me link
    // on the admin project page is decoded and checked (criterion 25).
    const { projectId } = await freshLink(SEED_SLUG);
    const REFERRAL_NAME = "Zzyxth Referralperson";
    const REFERRAL_CONTACT = "zzyxth-referral@example.invalid";
    await query("DELETE FROM Referral WHERE projectId = ?", [projectId]);
    await query("INSERT INTO Referral (id, projectId, name, contact, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
      `leakw${Date.now()}`, projectId, REFERRAL_NAME, REFERRAL_CONTACT,
    ]);

    const { hash } = await import("bcryptjs");
    const email = "e2e-leak@example.invalid";
    await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [email]);
    await query("DELETE FROM AdminUser WHERE email = ?", [email]);
    await query("INSERT INTO AdminUser (id, email, name, passwordHash, createdAt) VALUES (?, ?, ?, ?, NOW(3))", [
      `e2elk${Date.now()}`, email, "Leak", await hash("a-long-enough-passphrase", 12),
    ]);
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill("a-long-enough-passphrase");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("heading", { name: /^projects$/i })).toBeVisible();

    await page.goto(`/admin/projects/${projectId}`);
    const links = await page.locator('a[href*="wa.me"]').evaluateAll((els) =>
      els.map((el) => (el as HTMLAnchorElement).href),
    );
    for (const href of links) {
      const text = decodeURIComponent(href);
      expect(text, "a WhatsApp template carried a referral").not.toContain(REFERRAL_NAME);
      expect(text).not.toContain(REFERRAL_CONTACT);
    }

    await query("DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email = ?)", [email]);
    await query("DELETE FROM AdminUser WHERE email = ?", [email]);
  });

  test("private zones send noindex and no-store, and robots disallows them", async ({ request }) => {
    // The whole host is private now, so one Disallow covers it (ADR 0012).
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /");
    expect(robots).not.toContain("Allow: /");
    for (const route of ["/", "/p/anything", "/admin", "/agreement/anything/print"]) {
      const response = await request.get(route, { maxRedirects: 0 });
      expect(response.headers()["x-robots-tag"], route).toContain("noindex");
      expect(response.headers()["cache-control"], route).toContain("no-store");
    }
  });

  test("the root is a way into the portal, not the marketing site", async ({ request }) => {
    // ADR 0012: this host serves the portal and the admin. The marketing site
    // is kept in components/marketing and is not routed here.
    const body = await (await request.get("/")).text();
    expect(body).toContain("Open the link we sent you");
    expect(body).not.toContain("The same loop, once.");
    expect(body).not.toContain("Start the two weeks");
  });
});
