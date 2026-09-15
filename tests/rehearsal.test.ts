import { afterAll, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { db } from "@/lib/db";
import { removeClientUploads } from "@/lib/storage";
import { rehearsalCounts, startClean, wipeEverything } from "@/modules/clients/rehearsal";

/**
 * ADR 0023. The clean start empties every client-shaped table and keeps the
 * rest, refuses once the portal is live, and takes the client uploads while
 * leaving the image library. The wipe itself is tried inside a transaction
 * that is rolled back on purpose, so the local database comes out untouched.
 */
afterAll(async () => {
  await db.$disconnect();
});

describe("the clean start before launch", () => {
  it("empties every client-shaped table and keeps admins and the library, then rolls back", async () => {
    const before = await rehearsalCounts();
    const admins = await db.adminUser.count();
    const library = await db.imageLibrary.count();
    await expect(
      db.$transaction(
        async (tx) => {
          await wipeEverything(tx);
          expect(await tx.client.count()).toBe(0);
          expect(await tx.project.count()).toBe(0);
          expect(await tx.signoffEvent.count()).toBe(0);
          expect(await tx.invoice.count()).toBe(0);
          expect(await tx.invoiceSequence.count(), "the next invoice is 0001 again").toBe(0);
          expect(await tx.activityEvent.count()).toBe(0);
          expect(await tx.intakeVersion.count()).toBe(0);
          expect(await tx.adminUser.count(), "logins stay").toBe(admins);
          expect(await tx.imageLibrary.count(), "the library stays").toBe(library);
          expect(await tx.company.count(), "the company row stays").toBe(1);
          throw new Error("rolled back on purpose");
        },
        { timeout: 60_000 },
      ),
    ).rejects.toThrow("rolled back on purpose");
    expect(await rehearsalCounts(), "nothing actually went").toEqual(before);
  });

  it("refuses once the portal is live, and touches nothing", async () => {
    await db.setting.upsert({
      where: { key: "live_since" },
      create: { key: "live_since", value: new Date().toISOString(), type: "datetime" },
      update: {},
    });
    try {
      const before = await rehearsalCounts();
      expect(await startClean({ adminId: "t", adminName: "Test" }, "trying anyway")).toEqual({ ok: false, reason: "live" });
      expect(await rehearsalCounts()).toEqual(before);
    } finally {
      await db.setting.delete({ where: { key: "live_since" } });
    }
  });

  it("removes the client uploads and leaves the image library beside them", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "awtm-uploads-"));
    const previous = process.env.UPLOAD_DIR;
    process.env.UPLOAD_DIR = root;
    try {
      await mkdir(path.join(root, "clients", "c1"), { recursive: true });
      await writeFile(path.join(root, "clients", "c1", "a.jpg"), "x");
      await mkdir(path.join(root, "library"), { recursive: true });
      await writeFile(path.join(root, "library", "b.png"), "y");
      await removeClientUploads();
      await expect(stat(path.join(root, "clients"))).rejects.toThrow();
      expect((await stat(path.join(root, "library", "b.png"))).isFile()).toBe(true);
    } finally {
      process.env.UPLOAD_DIR = previous;
    }
  });
});
