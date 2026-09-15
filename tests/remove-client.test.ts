import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hash } from "bcryptjs";
import { IntakeParty, SignoffKind, SignoffMethod, TypeOfWork } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { reauthenticateAdmin } from "@/modules/auth/admin";
import { describeBlockers, removeClient } from "@/modules/clients/remove";

/**
 * ADR 0022. A client can be removed while nothing of theirs is evidence, and
 * not once anything is. What survives is one line in the log with no contact
 * detail in it. And the admin has to prove it is them first.
 */
const stamp = () => `${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
const kind = Object.values(TypeOfWork)[0];
const made: { clients: string[]; projects: string[]; admins: string[] } = { clients: [], projects: [], admins: [] };

async function clientWithProject(business: string) {
  const s = stamp();
  const client = await db.client.create({
    data: { businessName: business, contactName: "Remove Test", contactPhone: "+910000000001", contactEmail: `remove-${s}@example.test`, accessTokenHash: `rm-${s}` },
  });
  const project = await db.project.create({
    data: { clientId: client.id, name: "Never agreed", slug: `rm-${s}`, typeOfWork: kind, signoffPersonName: "R", signoffPersonEmail: "r@example.test" },
  });
  made.clients.push(client.id);
  made.projects.push(project.id);
  return { client, project };
}

beforeAll(async () => {
  await db.$executeRaw`DELETE FROM RateLimit`;
});

afterAll(async () => {
  // Evidence cannot go through the wrapper, which is the point; the test's
  // own leftovers go in raw SQL, the way the end-to-end fixtures tidy up.
  for (const id of made.projects) {
    await db.$executeRaw`DELETE FROM SignoffEvent WHERE projectId = ${id}`;
    await db.$executeRaw`DELETE FROM ActivityEvent WHERE projectId = ${id}`;
    await db.$executeRaw`DELETE FROM Project WHERE id = ${id}`;
  }
  for (const id of made.clients) {
    await db.$executeRaw`DELETE FROM IntakeVersion WHERE clientId = ${id}`;
    await db.$executeRaw`DELETE FROM ClientSession WHERE clientId = ${id}`;
    await db.$executeRaw`DELETE FROM Client WHERE id = ${id}`;
  }
  for (const id of made.admins) await db.$executeRaw`DELETE FROM AdminUser WHERE id = ${id}`;
  await db.$disconnect();
});

describe("removing a client", () => {
  it("takes everything of theirs that is not evidence, and leaves one line that names no contact detail", async () => {
    const { client, project } = await clientWithProject("Remove Me Ltd");
    await db.intakeVersion.create({ data: { clientId: client.id, version: 1, answers: {}, accessGranted: {}, sentBy: IntakeParty.CLIENT } });
    await db.clientSession.create({ data: { clientId: client.id, tokenHash: `s-${stamp()}`, expiresAt: new Date(Date.now() + 60_000) } });
    await db.activityEvent.create({ data: { type: "project.created", payload: {}, actor: "test", projectId: project.id } });

    const result = await removeClient(client.id, { adminId: "test", adminName: "Test admin" }, "a client added by mistake");
    expect(result).toMatchObject({ ok: true, businessName: "Remove Me Ltd", projects: 1 });

    expect(await db.client.findUnique({ where: { id: client.id } })).toBeNull();
    expect(await db.project.count({ where: { id: project.id } })).toBe(0);
    expect(await db.intakeVersion.count({ where: { clientId: client.id } }), "the guarded rows went with them").toBe(0);
    expect(await db.clientSession.count({ where: { clientId: client.id } })).toBe(0);
    expect(await db.activityEvent.count({ where: { projectId: project.id } })).toBe(0);

    const trace = await db.activityEvent.findFirst({ where: { type: "client.removed" }, orderBy: { createdAt: "desc" } });
    expect(trace).not.toBeNull();
    expect(trace!.payload).toMatchObject({ businessName: "Remove Me Ltd", projects: 1, reason: "a client added by mistake", by: "Test admin" });
    expect(JSON.stringify(trace!.payload)).not.toContain("@example.test");
    expect(JSON.stringify(trace!.payload)).not.toContain("+91");
  });

  it("refuses once anything is evidence, and touches nothing", async () => {
    const { client, project } = await clientWithProject("Signed Already Ltd");
    await db.signoffEvent.create({ data: { projectId: project.id, kind: SignoffKind.AGREEMENT, method: SignoffMethod.PORTAL, actorName: "Asha" } });

    const result = await removeClient(client.id, { adminId: "test", adminName: "Test admin" }, "trying anyway");
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "blocked") throw new Error("expected blocked");
    expect(result.blockers.signoffs).toBe(1);
    expect(describeBlockers(result.blockers)).toEqual(["a sign-off was recorded"]);
    expect(await db.client.findUnique({ where: { id: client.id } })).not.toBeNull();
    expect(await db.project.count({ where: { id: project.id } })).toBe(1);
  });

  it("gives nothing for a client that does not exist", async () => {
    expect(await removeClient("no-such-client", { adminId: "test", adminName: "Test admin" }, "x")).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("the admin proving it is them", () => {
  it("accepts their password, refuses another, and locks after five wrong tries", async () => {
    const admin = await db.adminUser.create({
      data: { email: `reauth-${stamp()}@example.test`, name: "Reauth", passwordHash: await hash("the-right-passphrase", 4) },
    });
    made.admins.push(admin.id);
    expect(await reauthenticateAdmin(admin.id, "not it")).toBe("bad_password");
    expect(await reauthenticateAdmin(admin.id, "the-right-passphrase")).toBe("ok");
    for (let i = 0; i < 3; i++) expect(await reauthenticateAdmin(admin.id, "still not it")).toBe("bad_password");
    // Five tries are spent, right or wrong. The sixth is refused before it is compared.
    expect(await reauthenticateAdmin(admin.id, "the-right-passphrase")).toBe("rate_limited");
  });

  it("refuses an account that has no password yet", async () => {
    const admin = await db.adminUser.create({ data: { email: `unset-${stamp()}@example.test`, name: "Unset" } });
    made.admins.push(admin.id);
    expect(await reauthenticateAdmin(admin.id, "")).toBe("bad_password");
  });
});
