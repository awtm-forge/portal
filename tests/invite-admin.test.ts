import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { canManageTeam, inviteAdmin, isOwner, removeAdminAccess, removeUnusedAdmin } from "@/modules/auth/admin";

/**
 * PORTAL-SPEC 6.6 as amended by ADR 0024: no self-registration, an owner who
 * adds as many admins as needed from settings, and access that can be taken
 * away without losing what that admin did.
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

  it("does not stop at two seats: the owner adds as many as needed (ADR 0024)", async () => {
    // The old rule was two accounts and no more. Ayush, 15 Sep: "there is no
    // boundation for number of admins".
    await inviteAdmin({ email: A, name: "A" });
    await inviteAdmin({ email: B, name: "B" });
    const third = await inviteAdmin({ email: C, name: "C" });
    expect(third.ok).toBe(true);
    expect(await db.adminUser.count({ where: { email: { in: [A, B, C] } } })).toBe(3);
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

  it("a freed seat's address can simply be invited again", async () => {
    // There is no limit to be at any more (ADR 0024); freeing a seat is about
    // tidying a stale row, and the same address can come back with a fresh link.
    const first = await inviteAdmin({ email: A, name: "A" });
    expect(first.ok).toBe(true);
    expect(await removeUnusedAdmin(A)).toEqual({ ok: true });
    const again = await inviteAdmin({ email: A, name: "A again" });
    expect(again.ok).toBe(true);
    if (first.ok && again.ok) expect(again.token).not.toBe(first.token);
    expect((await db.adminUser.findUniqueOrThrow({ where: { email: A } })).name).toBe("A again");
  });
});

describe("the owner, and taking access away", () => {
  const withOwner = async (email: string | undefined, fn: () => Promise<void>) => {
    const before = process.env.OWNER_EMAIL;
    if (email === undefined) delete process.env.OWNER_EMAIL; else process.env.OWNER_EMAIL = email;
    try { await fn(); } finally { if (before === undefined) delete process.env.OWNER_EMAIL; else process.env.OWNER_EMAIL = before; }
  };

  it("lets everyone manage the team while no owner is named, and only the owner once one is", async () => {
    await withOwner(undefined, async () => {
      expect(canManageTeam({ email: A })).toBe(true);
      expect(isOwner({ email: A })).toBe(false);
    });
    await withOwner(A.toUpperCase(), async () => {
      expect(canManageTeam({ email: A })).toBe(true);
      expect(isOwner({ email: A })).toBe(true);
      expect(canManageTeam({ email: B })).toBe(false);
    });
  });

  it("takes an active admin's access away and keeps the row, and refuses self and the owner", async () => {
    await inviteAdmin({ email: A, name: "A" });
    await inviteAdmin({ email: B, name: "B" });
    const a = await db.adminUser.findUniqueOrThrow({ where: { email: A } });
    const b = await db.adminUser.findUniqueOrThrow({ where: { email: B } });
    await db.adminUser.update({ where: { id: b.id }, data: { passwordHash: "x".repeat(60) } });
    await db.adminSession.create({ data: { adminUserId: b.id, tokenHash: `t-${Date.now()}`, expiresAt: new Date(Date.now() + 60_000) } });

    await withOwner(A, async () => {
      expect(await removeAdminAccess(A, { id: b.id, email: B }), "the owner's access stays").toEqual({ ok: false, reason: "owner" });
      expect(await removeAdminAccess(B, { id: b.id, email: B }), "not your own").toEqual({ ok: false, reason: "self" });
      expect(await removeAdminAccess(B, { id: a.id, email: A })).toEqual({ ok: true });
    });
    const after = await db.adminUser.findUniqueOrThrow({ where: { email: B } });
    expect(after.passwordHash).toBeNull();
    expect(after.setupTokenHash).toBeNull();
    expect(after.accessRemovedAt).not.toBeNull();
    expect(await db.adminSession.count({ where: { adminUserId: b.id } }), "signed out everywhere").toBe(0);
    // A seat with no access to take away says so rather than pretending.
    expect(await removeAdminAccess(B, { id: a.id, email: A })).toEqual({ ok: false, reason: "not_active" });
    // And a reissue gives them a way back in, clearing the stamp.
    const back = await inviteAdmin({ email: B, name: "B" });
    expect(back.ok).toBe(true);
    expect((await db.adminUser.findUniqueOrThrow({ where: { email: B } })).accessRemovedAt).toBeNull();
  });
});
