import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { listForClient, tellClient, unreadCount } from "@/modules/notifications/client";

/** Q19: the subscriber writes a notification for the client from an event. */
const BUSINESS = "Notify Test";
let clientId = "";

async function clearUp() {
  await db.$executeRaw`DELETE FROM ClientNotification WHERE clientId IN (SELECT id FROM Client WHERE businessName = ${BUSINESS})`;
  await db.$executeRaw`DELETE FROM Client WHERE businessName = ${BUSINESS}`;
}
beforeEach(async () => {
  await clearUp();
  const c = await db.client.create({ data: { businessName: BUSINESS, contactName: "C", contactPhone: "+910000000009", contactEmail: "notify@example.test", accessTokenHash: `notify-${Math.random().toString(36).slice(2)}` } });
  clientId = c.id;
});
afterAll(async () => { await clearUp(); await db.$disconnect(); });

describe("telling the client", () => {
  it("writes a notification for an event that concerns them, and nothing for one that does not", async () => {
    await tellClient({ type: "agreement.sent", projectId: null, actor: "team", payload: { clientId, businessName: BUSINESS, projectName: "P", version: 1 } });
    const items = await listForClient(clientId);
    expect(items).toHaveLength(1);
    expect(items[0].title).toMatch(/agreement is ready/i);
    expect(items[0].path).toBe("/agreement");
    expect(await unreadCount(clientId)).toBe(1);

    await tellClient({ type: "agreement.agreed", projectId: null, actor: "client", payload: { clientId } });
    expect(await listForClient(clientId)).toHaveLength(1);
  });

  it("resolves the client from the project when the payload has no clientId", async () => {
    const project = await db.project.create({ data: { clientId, name: "N", slug: `notify-${Date.now()}`, typeOfWork: "STORE", signoffPersonName: "C", signoffPersonEmail: "c@example.test" } });
    await tellClient({ type: "review.opened", projectId: project.id, actor: "team", payload: { round: 1, projectName: "N" } });
    const items = await listForClient(clientId);
    expect(items).toHaveLength(1);
    expect(items[0].path).toBe("/review");
    await db.$executeRaw`DELETE FROM Project WHERE id = ${project.id}`;
  });
})
