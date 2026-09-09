import { expect, test } from "@playwright/test";
import { closeDb, query } from "./fixtures";

/**
 * ADR 0014. The page itself: it is not there when the system is claimed, and
 * that is the state the suite runs in, because the seed makes an admin.
 *
 * The happy path is covered in tests/first-run.test.ts, which can empty the
 * admin table and put it back. Doing that here would pull the rug from every
 * other spec running against the same database.
 */
test.afterAll(closeDb);

test("is not there once somebody can actually sign in", async ({ request }) => {
  const [row] = await query<{ n: number }>("SELECT COUNT(*) AS n FROM AdminUser WHERE passwordHash IS NOT NULL");
  expect(Number(row.n), "the suite should have left an admin with a password").toBeGreaterThan(0);

  const response = await request.get("/admin/first-run", { maxRedirects: 0 });
  expect(response.status()).toBe(404);
});

test("says nothing about itself to a search engine, like the rest of the zone", async ({ request }) => {
  const response = await request.get("/admin/first-run", { maxRedirects: 0 });
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
  expect(response.headers()["cache-control"]).toContain("no-store");
});
