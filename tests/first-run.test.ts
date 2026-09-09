import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { activatedAdminCount, createFirstAdmin } from "@/modules/auth/admin";

/**
 * ADR 0014. A route that can create an administrator is worth being paranoid
 * about, so every way in is pinned here: it works once, only with the key,
 * only while nobody has claimed the system, and never without a key set.
 */
const KEY = "a-long-random-setup-key-value";
const KEEP = process.env.SETUP_KEY;
const headers = () => new Headers({ "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250) + 1}` });

/**
 * Getting to zero admins is the whole difficulty: an intake row names the
 * admin who uploaded its document, and that column is required, so the table
 * cannot be emptied while intakes exist. The rows are put back afterwards
 * exactly as they were, because the rest of the suite is built on them.
 */
type SavedAdmin = { id: string; email: string; name: string; passwordHash: string | null };
type SavedIntake = Record<string, unknown>;
let savedAdmins: SavedAdmin[] = [];
let savedIntakes: SavedIntake[] = [];

async function emptyTheAdmins() {
  savedAdmins = await db.adminUser.findMany({ select: { id: true, email: true, name: true, passwordHash: true } });
  savedIntakes = (await db.intake.findMany()) as unknown as SavedIntake[];
  await db.$executeRaw`DELETE FROM Intake`;
  await db.$executeRaw`DELETE FROM AdminSession`;
  await db.$executeRaw`DELETE FROM AdminUser`;
  await db.$executeRaw`DELETE FROM RateLimit WHERE \`key\` LIKE 'first-run:%'`;
}

async function putThemBack() {
  await db.$executeRaw`DELETE FROM Intake`;
  await db.$executeRaw`DELETE FROM AdminSession`;
  await db.$executeRaw`DELETE FROM AdminUser`;
  await db.$executeRaw`DELETE FROM RateLimit WHERE \`key\` LIKE 'first-run:%'`;
  for (const a of savedAdmins) {
    await db.adminUser.create({ data: { id: a.id, email: a.email, name: a.name, passwordHash: a.passwordHash } });
  }
  for (const i of savedIntakes) {
    await db.intake.create({ data: i as never });
  }
}

beforeEach(async () => {
  process.env.SETUP_KEY = KEY;
  await emptyTheAdmins();
});

afterEach(async () => {
  if (KEEP === undefined) delete process.env.SETUP_KEY;
  else process.env.SETUP_KEY = KEEP;
  await putThemBack();
});

describe("making the very first admin", () => {
  it("works once, and issues a setup link rather than a password", async () => {
    const result = await createFirstAdmin({ email: "R@Awtmforge.com", name: "Rahul", key: KEY, headers: headers() });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{20,}$/);

    const user = await db.adminUser.findUniqueOrThrow({ where: { email: "r@awtmforge.com" } });
    expect(user.name).toBe("Rahul");
    // No password is set here. That happens on the setup screen, which is the
    // only place in the system where one ever is.
    expect(user.passwordHash).toBeNull();
    expect(user.setupTokenHash).not.toBeNull();
  });

  it("is shut the moment somebody can actually sign in", async () => {
    const first = await createFirstAdmin({ email: "first@example.invalid", name: "First", key: KEY, headers: headers() });
    expect(first.ok).toBe(true);
    // Still open: the account exists but has no password, so nobody can get
    // in and the door has to stay open or the system is bricked.
    const again = await createFirstAdmin({ email: "second@example.invalid", name: "Second", key: KEY, headers: headers() });
    expect(again.ok).toBe(true);

    // Somebody sets a password. Now it is shut.
    await db.adminUser.updateMany({ where: { email: "first@example.invalid" }, data: { passwordHash: "$2b$12$x" } });
    const after = await createFirstAdmin({ email: "third@example.invalid", name: "Third", key: KEY, headers: headers() });
    expect(after).toEqual({ ok: false, reason: "not_first_run" });
  });

  it("reissues the link for an account whose link was lost, rather than locking everyone out", async () => {
    // The live failure on 9 September: admin:create had made a row, nobody
    // saw the link it printed, and the page then hid itself behind a row that
    // no one could use.
    await db.adminUser.create({ data: { email: "stuck@awtmforge.com", name: "Stuck" } });
    expect(await activatedAdminCount()).toBe(0);

    const result = await createFirstAdmin({ email: "stuck@awtmforge.com", name: "Stuck", key: KEY, headers: headers() });
    expect(result.ok).toBe(true);
    const rows = await db.adminUser.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].setupTokenHash).not.toBeNull();
  });

  it("refuses a wrong key, and tells a wrong key nothing about the system", async () => {
    const bad = await createFirstAdmin({ email: "a@example.invalid", name: "A", key: "wrong", headers: headers() });
    expect(bad).toEqual({ ok: false, reason: "bad_key" });
    expect(await activatedAdminCount()).toBe(0);

    // Same answer once the system is claimed: bad_key, not not_first_run, so
    // a guesser cannot learn whether there is anything left to take.
    await createFirstAdmin({ email: "b@example.invalid", name: "B", key: KEY, headers: headers() });
    const after = await createFirstAdmin({ email: "c@example.invalid", name: "C", key: "wrong", headers: headers() });
    expect(after).toEqual({ ok: false, reason: "bad_key" });
  });

  it("refuses when no key is configured, rather than letting anyone in", async () => {
    delete process.env.SETUP_KEY;
    const result = await createFirstAdmin({ email: "a@example.invalid", name: "A", key: "", headers: headers() });
    expect(result).toEqual({ ok: false, reason: "no_key_configured" });
    expect(await activatedAdminCount()).toBe(0);
  });

  it("refuses an empty key even when SETUP_KEY is an empty string", async () => {
    process.env.SETUP_KEY = "   ";
    expect(await createFirstAdmin({ email: "a@example.invalid", name: "A", key: "   ", headers: headers() }))
      .toEqual({ ok: false, reason: "no_key_configured" });
    expect(await activatedAdminCount()).toBe(0);
  });

  it("refuses nonsense for an email or a name", async () => {
    for (const [email, name] of [["notanemail", "A"], ["a@example.invalid", ""], ["a@example.invalid", "x".repeat(200)]]) {
      expect(await createFirstAdmin({ email, name, key: KEY, headers: headers() })).toEqual({ ok: false, reason: "invalid" });
    }
    expect(await activatedAdminCount()).toBe(0);
  });

  it("gives one account when the same person presses twice at once", async () => {
    const h = headers();
    const results = await Promise.all([
      createFirstAdmin({ email: "one@example.invalid", name: "One", key: KEY, headers: h }),
      createFirstAdmin({ email: "one@example.invalid", name: "One", key: KEY, headers: h }),
    ]);
    expect(results.some((r) => r.ok)).toBe(true);
    expect(await db.adminUser.count()).toBe(1);
  });

  it("stops a guesser after five tries from one address", async () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9" });
    for (let i = 0; i < 5; i++) {
      expect(await createFirstAdmin({ email: "a@example.invalid", name: "A", key: "wrong", headers: h })).toEqual({
        ok: false, reason: "bad_key",
      });
    }
    expect(await createFirstAdmin({ email: "a@example.invalid", name: "A", key: KEY, headers: h })).toEqual({
      ok: false, reason: "rate_limited",
    });
    expect(await activatedAdminCount()).toBe(0);
  });
});
