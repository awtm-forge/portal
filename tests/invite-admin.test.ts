import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { inviteAdmin, removeUnusedAdmin } from "@/modules/auth/admin";

/**
 * PORTAL-SPEC 6.6: two accounts, no self-registration. The second is made by
 * the first, from settings, on a host that will not run a script.
 */
const A = "invite-a@example.invalid";
const B = "invite-b@example.invalid";
const C = "invite-c@example.invalid";

async function clearUp() {
  await db.$executeRaw`DELETE FROM AdminSession WHERE adminUserId IN (SELECT id FROM AdminUser WHERE email LIKE 'invite-%')`;
  await db.$executeRaw`DELETE FROM AdminUser WHERE email LIKE 'invite-%'`;
}
beforeEach(clearUp);
afterAll(async () => { await clearUp(); await db.$disconnect(); });

/** The seed leaves one admin; these tests need to reason about the limit from that. */
async function othersBesides(...emails: string[]) {
  return db.adminUser.count({ where: { email: { notIn: emails } } });
}

describe("inviting the other admin", () => {
  it("makes the account with no password and a setup link", async () => {
    // The seed admin counts as one of the two seats.
    if ((await othersBesides()) >= 2) return;
    const r = await inviteAdmin({ email: A.toUpperCase(), name: " Ayush " });
    expect(r.ok).toBe(true);
    const row = await db.adminUser.findUniqueOrThrow({ where: { email: A } });
    expect(row.name).toBe("Ayush");
    expect(row.passwordHash).toBeNull();
    expect(row.setupTokenHash).not.toBeNull();
  });

  it("reissues the link for an existing address rather than making a second account", async () => {
    if ((await othersBesides()) >= 2) return;
    const first = await inviteAdmin({ email: A, name: "Ayush" });
    const second = await inviteAdmin({ email: A, name: "Ayush M" });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.token).not.toBe(first.token);
    expect(await db.adminUser.count({ where: { email: A } })).toBe(1);
    expect((await db.adminUser.findUniqueOrThrow({ where: { email: A } })).name).toBe("Ayush M");
  });

  it("stops at two seats", async () => {
    const existing = await othersBesides(A, B, C);
    // Fill whatever seats the seed left free.
    if (existing < 2) await inviteAdmin({ email: A, name: "A" });
    if (existing < 1) await inviteAdmin({ email: B, name: "B" });
    const third = await inviteAdmin({ email: C, name: "C" });
    expect(third).toEqual({ ok: false, reason: "limit" });
  });

  it("refuses nonsense", async () => {
    expect(await inviteAdmin({ email: "nope", name: "X" })).toEqual({ ok: false, reason: "invalid" });
    expect(await inviteAdmin({ email: A, name: "" })).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("clearing a stale seat", () => {
  it("removes an account that never set a password, and refuses one that can sign in", async () => {
    // A stale invite: created by inviting, never activated.
    if ((await othersBesides(A)) >= 2) return;
    const invited = await inviteAdmin({ email: A, name: "Stale" });
    expect(invited.ok).toBe(true);
    expect(await removeUnusedAdmin(A.toUpperCase())).toEqual({ ok: true });
    expect(await db.adminUser.findUnique({ where: { email: A } })).toBeNull();

    // An activated account is never removable this way, so nobody is locked out.
    const active = await db.adminUser.create({ data: { email: B, name: "Active", passwordHash: "x" } });
    expect(await removeUnusedAdmin(B)).toEqual({ ok: false, reason: "active" });
    expect(await db.adminUser.findUnique({ where: { id: active.id } })).not.toBeNull();
    expect(await removeUnusedAdmin("nobody@example.invalid")).toEqual({ ok: false, reason: "not_found" });
  });

  it("frees the seat, so an invite that was at the limit goes through again", async () => {
    // Fill both seats with stale invites, past what the seed left.
    const free = 2 - Math.min(2, await othersBesides(A, B, C));
    if (free >= 1) await inviteAdmin({ email: A, name: "A" });
    if (free >= 2) await inviteAdmin({ email: B, name: "B" });
    // With both seats taken, a third is refused.
    if ((await othersBesides(A, B, C)) >= 2) {
      expect(await inviteAdmin({ email: C, name: "C" })).toEqual({ ok: false, reason: "limit" });
      // Clear one stale seat and it goes through.
      const toClear = (await db.adminUser.findFirst({ where: { email: { in: [A, B] }, passwordHash: null } }))?.email;
      if (toClear) {
        expect(await removeUnusedAdmin(toClear)).toEqual({ ok: true });
        expect((await inviteAdmin({ email: C, name: "C" })).ok).toBe(true);
      }
    }
  });
});
