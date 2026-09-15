import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { removeClientUploads } from "@/lib/storage";
import { emit } from "@/modules/events";
import { liveSince, setLive } from "@/modules/settings";

/**
 * The rehearsal, and the clean start that ends it (ADR 0023, Ayush 15 Sep).
 *
 * The rule that a sign-off, an issued invoice and a review round are never
 * deleted is a rule about real clients. Until the team says the portal is
 * live, there are none: every client in it was added to try the thing out,
 * and the invoices they were issued hold numbers a real client should get.
 * So in rehearsal one control on the settings page erases every client and
 * everything that ever happened to them, in one transaction, and starts the
 * invoice numbering again. Saying the portal is live is one way, and after it
 * this file refuses.
 *
 * The wipe is raw SQL by design, outside the model guard, which is the point
 * of the guard: nothing that reads like ordinary code can do this. The tables
 * go in dependency order because nothing cascades; the list is the whole
 * client side of the schema and nothing else. Kept: admin accounts and their
 * sessions, the company row, settings, the image library, the migrations.
 */
export const START_CLEAN_PHRASE = "erase every client";

const ORDER = [
  "ActivityEvent",
  "Referral",
  "Testimonial",
  "Day30",
  "ReviewRound",
  "Update",
  "Invoice",
  "InvoiceSequence",
  "SignoffEvent",
  "AgreementNote",
  "Agreement",
  "ClientNotification",
  "IntakeChangeRequest",
  "IntakeVersion",
  "IntakeFile",
  "ClientDocument",
  "Intake",
  "OneTimeCode",
  "ClientSession",
  "Project",
  "Client",
  "RateLimit",
  "Enquiry",
] as const;

export type RehearsalCounts = { clients: number; projects: number; signoffs: number; invoices: number };

export async function rehearsalCounts(): Promise<RehearsalCounts> {
  const [clients, projects, signoffs, invoices] = await Promise.all([
    db.client.count(),
    db.project.count(),
    db.signoffEvent.count(),
    db.invoice.count(),
  ]);
  return { clients, projects, signoffs, invoices };
}

/** Every table in ORDER, emptied. Names come from the constant list above, never from input. */
export async function wipeEverything(tx: Prisma.TransactionClient): Promise<void> {
  for (const table of ORDER) await tx.$executeRawUnsafe(`DELETE FROM \`${table}\``);
}

export type StartCleanResult = { ok: true; before: RehearsalCounts } | { ok: false; reason: "live" };

class Live extends Error {}

export async function startClean(actor: { adminId: string; adminName: string }, reason: string): Promise<StartCleanResult> {
  if (await liveSince()) return { ok: false, reason: "live" };
  const before = await rehearsalCounts();
  try {
    await db.$transaction(
      async (tx) => {
        // Checked again inside: the switch to live thrown between the first
        // look and this wipe must win.
        if (await liveSince(tx)) throw new Live();
        await wipeEverything(tx);
      },
      { timeout: 60_000 },
    );
  } catch (error) {
    if (error instanceof Live) return { ok: false, reason: "live" };
    throw error;
  }
  await removeClientUploads();
  await emit({
    type: "system.started_clean",
    projectId: null,
    actor: actor.adminName,
    payload: { ...before, by: actor.adminName, reason },
  });
  return { ok: true, before };
}

/** One way. The date it was first said stands. */
export async function goLive(actor: { adminId: string; adminName: string }): Promise<Date> {
  const at = await setLive();
  await emit({ type: "system.live", projectId: null, actor: actor.adminName, payload: { by: actor.adminName, at: at.toISOString() } });
  return at;
}
