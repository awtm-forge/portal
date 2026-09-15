import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { IntakeParty } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { listDocuments, removeDocument, serveDocument, storeDocuments } from "@/modules/documents";

/**
 * ADR 0025. A client's files: stored through the same pipeline as a
 * questionnaire upload, listed newest first, served only to their owner,
 * removable by either side, and each upload tells the other side once.
 */
// A 1 by 1 PNG, so the pipeline has a real image to re-encode.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const stamp = `${Date.now()}`;
let clientId = "";
let root = "";
let previousRoot: string | undefined;

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "awtm-docs-"));
  previousRoot = process.env.UPLOAD_DIR;
  process.env.UPLOAD_DIR = root;
  const client = await db.client.create({
    data: { businessName: "Docs Test", contactName: "D", contactPhone: "+910000000002", contactEmail: `docs-${stamp}@example.test`, accessTokenHash: `docs-${stamp}` },
  });
  clientId = client.id;
});

afterAll(async () => {
  process.env.UPLOAD_DIR = previousRoot;
  await db.$executeRaw`DELETE FROM ClientDocument WHERE clientId = ${clientId}`;
  await db.$executeRaw`DELETE FROM ActivityEvent WHERE type IN ('document.uploaded', 'document.added') AND JSON_EXTRACT(payload, '$.clientId') = ${clientId}`;
  await db.$executeRaw`DELETE FROM Client WHERE id = ${clientId}`;
  await db.$disconnect();
});

describe("a client's files", () => {
  it("stores an image with a thumbnail, lists it, serves it to its owner only, and tells the team once", async () => {
    const file = new File([PNG], "logo.png", { type: "image/png" });
    const result = await storeDocuments({ clientId, businessName: "Docs Test", files: [file], note: "  our logo ", by: IntakeParty.CLIENT, actor: "client" });
    expect(result.refused).toEqual([]);
    expect(result.stored).toHaveLength(1);

    const docs = await listDocuments(clientId);
    expect(docs).toHaveLength(1);
    expect(docs[0].name).toBe("logo.png");
    expect(docs[0].mime).toBe("image/png");
    expect(docs[0].hasThumb).toBe(true);
    expect(docs[0].note).toBe("our logo");
    expect(docs[0].by).toBe(IntakeParty.CLIENT);

    const served = await serveDocument(clientId, docs[0].id, false);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/png");
    expect((await serveDocument("someone-else", docs[0].id, false)).status, "another client's id sees nothing").toBe(404);
    expect((await serveDocument(clientId, docs[0].id, true)).headers.get("content-type")).toBe("image/jpeg");

    const told = await db.activityEvent.findMany({ where: { type: "document.uploaded" }, orderBy: { createdAt: "desc" }, take: 1 });
    expect(told[0]?.payload).toMatchObject({ clientId, businessName: "Docs Test", count: 1, names: "logo.png", note: "our logo" });
  });

  it("refuses what the pipeline refuses, and says why by name", async () => {
    const junk = new File([Buffer.from("not an image at all")], "notes.exe", { type: "application/octet-stream" });
    const result = await storeDocuments({ clientId, businessName: "Docs Test", files: [junk], note: "", by: IntakeParty.CLIENT, actor: "client" });
    expect(result.stored).toEqual([]);
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0].name).toBe("notes.exe");
    expect(result.refused[0].message.length).toBeGreaterThan(0);
  });

  it("a team upload tells the client, not the team", async () => {
    const before = await db.activityEvent.count({ where: { type: "document.uploaded" } });
    const file = new File([PNG], "mockup.png", { type: "image/png" });
    await storeDocuments({ clientId, businessName: "Docs Test", files: [file], note: "", by: IntakeParty.TEAM, actor: "Rahul" });
    expect(await db.activityEvent.count({ where: { type: "document.uploaded" } }), "no team notice for the team's own upload").toBe(before);
    const added = await db.activityEvent.findMany({ where: { type: "document.added" }, orderBy: { createdAt: "desc" }, take: 1 });
    expect(added[0]?.payload).toMatchObject({ clientId, count: 1, names: "mockup.png" });
  });

  it("removes a file and its thumbnail from disk as well as the row, for its owner only", async () => {
    const docs = await listDocuments(clientId);
    const target = docs.find((d) => d.name === "logo.png")!;
    const row = await db.clientDocument.findUniqueOrThrow({ where: { id: target.id } });
    expect((await stat(path.join(root, row.storedPath))).isFile()).toBe(true);

    expect(await removeDocument("someone-else", target.id), "another client cannot remove it").toBe(false);
    expect(await removeDocument(clientId, target.id)).toBe(true);
    expect(await db.clientDocument.findUnique({ where: { id: target.id } })).toBeNull();
    await expect(stat(path.join(root, row.storedPath))).rejects.toThrow();
    if (row.thumbPath) await expect(stat(path.join(root, row.thumbPath))).rejects.toThrow();
    expect(await removeDocument(clientId, target.id), "gone is gone").toBe(false);
  });
});
