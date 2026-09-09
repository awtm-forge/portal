import type { Prisma } from "@/generated/prisma/client";
import { IntakeChangeStatus, type IntakeParty } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

type Writer = Prisma.TransactionClient | typeof db;

/**
 * ADR 0016. Once the questionnaire is sent, the answers are read-only until
 * the team opens them for a change, and every sending is kept as a version.
 * The agreement is written from these answers, so what was said, and when,
 * has to stay readable after the fact.
 *
 * The access checklist is not covered by the lock. Those ticks are granted
 * over the days after sending, and a lock on them would make the clock rule
 * in the access section mean nothing.
 */
export const LOCKED_MESSAGE = "This questionnaire has been sent. Ask us to open it if something needs changing.";

export async function openForWriting(tx: Writer, intake: { clientId: string; submittedAt: Date | null }): Promise<boolean> {
  if (!intake.submittedAt) return true;
  const open = await tx.intakeChangeRequest.findFirst({
    where: { clientId: intake.clientId, status: IntakeChangeStatus.OPEN },
    select: { id: true },
  });
  return open !== null;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** What an answer is, without when it was typed or by whom. */
function essence(entry: unknown): string {
  const e = asRecord(entry);
  return JSON.stringify({ value: e.value ?? null, note: e.note ?? null, files: e.files ?? null });
}

/** The keys whose answer differs between two answer documents, either way, sorted. */
export function changedKeys(before: unknown, after: unknown): string[] {
  const a = asRecord(before);
  const b = asRecord(after);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => essence(a[k]) !== essence(b[k])).sort();
}

/**
 * Writes the next version under the caller's transaction and says which
 * answers changed since the one before. The first version changes nothing:
 * it is the record of the first sending.
 */
export async function snapshotVersion(
  tx: Writer,
  clientId: string,
  answers: unknown,
  accessGranted: unknown,
  sentBy: IntakeParty,
): Promise<{ version: number; changed: string[] }> {
  const last = await tx.intakeVersion.findFirst({ where: { clientId }, orderBy: { version: "desc" } });
  const version = (last?.version ?? 0) + 1;
  const changed = last ? changedKeys(last.answers, answers) : [];
  await tx.intakeVersion.create({
    data: {
      clientId,
      version,
      answers: answers as Prisma.InputJsonValue,
      accessGranted: accessGranted as Prisma.InputJsonValue,
      sentBy,
    },
  });
  return { version, changed };
}

export type VersionSummary = { id: string; version: number; sentAt: Date; sentBy: IntakeParty; changed: string[] };

/** Every version, oldest first, each with the keys it changed from the one before. */
export async function versionsFor(clientId: string): Promise<VersionSummary[]> {
  const rows = await db.intakeVersion.findMany({ where: { clientId }, orderBy: { version: "asc" } });
  return rows.map((r, i) => ({
    id: r.id,
    version: r.version,
    sentAt: r.sentAt,
    sentBy: r.sentBy,
    changed: i === 0 ? [] : changedKeys(rows[i - 1].answers, r.answers),
  }));
}

export async function versionAt(clientId: string, version: number) {
  return db.intakeVersion.findUnique({ where: { clientId_version: { clientId, version } } });
}
