import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { allow } from "@/lib/rate-limit";

/**
 * PORTAL-SPEC 5.14. Written on 9 September 2026, after the first-run tests
 * found that two calls arriving together threw a duplicate key error out of
 * the limiter instead of counting: a double click was a 500, not a refusal.
 */
const KEY = () => `test:${Math.random().toString(36).slice(2)}`;

afterEach(async () => {
  await db.$executeRaw`DELETE FROM RateLimit WHERE \`key\` LIKE 'test:%'`;
});

describe("the rate limiter", () => {
  it("allows up to the limit and refuses after it", async () => {
    const k = KEY();
    for (let i = 0; i < 3; i++) expect(await allow(k, 3, 60), `call ${i + 1}`).toBe(true);
    expect(await allow(k, 3, 60)).toBe(false);
  });

  it("counts rather than throwing when calls arrive together", async () => {
    const k = KEY();
    const results = await Promise.all(Array.from({ length: 8 }, () => allow(k, 5, 60)));
    expect(results.filter(Boolean)).toHaveLength(5);
    expect(results.filter((r) => !r)).toHaveLength(3);
  });

  it("starts a fresh window once the old one has passed", async () => {
    const k = KEY();
    expect(await allow(k, 1, 60)).toBe(true);
    expect(await allow(k, 1, 60)).toBe(false);
    // Push the window into the past rather than waiting a minute.
    await db.$executeRaw`UPDATE RateLimit SET windowStart = DATE_SUB(NOW(3), INTERVAL 2 MINUTE) WHERE \`key\` = ${k}`;
    expect(await allow(k, 1, 60)).toBe(true);
  });

  it("keeps separate keys apart", async () => {
    const a = KEY();
    const b = KEY();
    expect(await allow(a, 1, 60)).toBe(true);
    expect(await allow(a, 1, 60)).toBe(false);
    expect(await allow(b, 1, 60)).toBe(true);
  });
});
