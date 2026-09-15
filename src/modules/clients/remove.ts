import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requestLogger, safeError } from "@/lib/logger";
import { removeStored } from "@/lib/storage";
import { emit } from "@/modules/events";

/**
 * Removing a client entirely (ADR 0022, Ayush 15 Sep).
 *
 * Allowed only while nothing of theirs is evidence: no sign-off, no invoice,
 * no review round, and so nothing downstream of those either. Before that
 * point a client is a link, a questionnaire and at most a project that was
 * never agreed, and all of it can go. After it, the record stays for good and
 * the project is cancelled or closed instead; the guard on the database client
 * enforces the second half whatever this file does.
 *
 * The questionnaire's versions and change requests, and the notes on an
 * unsigned agreement, are also append-only, because a living record must not
 * be rewritten. Removing the whole client is not rewriting it; it is the record
 * ceasing to exist, and once it has there is nothing for those rows to be
 * evidence of. They are cleared by name, in raw SQL, only here, and the guard
 * on model operations is untouched.
 *
 * What survives is one activity event: the business name, how many projects
 * went with it, who did it and why. No contact details.
 */
export type RemovalBlockers = { signoffs: number; invoices: number; reviewRounds: number; testimonials: number; day30s: number };

export type RemoveResult =
  | { ok: true; businessName: string; projects: number }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "blocked"; blockers: RemovalBlockers };

class Blocked extends Error {
  constructor(public readonly blockers: RemovalBlockers) {
    super("blocked");
  }
}

type Reader = Pick<typeof db, "signoffEvent" | "invoice" | "reviewRound" | "testimonial" | "day30">;

async function countBlockers(projectIds: string[], reader: Reader = db): Promise<RemovalBlockers> {
  if (projectIds.length === 0) return { signoffs: 0, invoices: 0, reviewRounds: 0, testimonials: 0, day30s: 0 };
  const where = { projectId: { in: projectIds } };
  const [signoffs, invoices, reviewRounds, testimonials, day30s] = await Promise.all([
    reader.signoffEvent.count({ where }),
    reader.invoice.count({ where }),
    reader.reviewRound.count({ where }),
    reader.testimonial.count({ where }),
    reader.day30.count({ where }),
  ]);
  return { signoffs, invoices, reviewRounds, testimonials, day30s };
}

export function isClear(b: RemovalBlockers): boolean {
  return b.signoffs === 0 && b.invoices === 0 && b.reviewRounds === 0 && b.testimonials === 0 && b.day30s === 0;
}

/** What stands in the way, in the words the page uses. Empty when nothing does. */
export function describeBlockers(b: RemovalBlockers): string[] {
  const out: string[] = [];
  if (b.signoffs > 0) out.push(b.signoffs === 1 ? "a sign-off was recorded" : `${b.signoffs} sign-offs were recorded`);
  if (b.invoices > 0) out.push(b.invoices === 1 ? "an invoice was issued" : `${b.invoices} invoices were issued`);
  if (b.reviewRounds > 0) out.push(b.reviewRounds === 1 ? "a review was opened" : `${b.reviewRounds} reviews were opened`);
  if (b.testimonials > 0) out.push("a testimonial exists");
  if (b.day30s > 0) out.push("the day-30 record exists");
  return out;
}

export async function removalBlockers(clientId: string): Promise<RemovalBlockers> {
  const projects = await db.project.findMany({ where: { clientId }, select: { id: true } });
  return countBlockers(projects.map((p) => p.id));
}

export async function removeClient(
  clientId: string,
  actor: { adminId: string; adminName: string },
  reason: string,
): Promise<RemoveResult> {
  const client = await db.client.findUnique({
    where: { id: clientId },
    include: { projects: { select: { id: true } }, files: { select: { storedPath: true } } },
  });
  if (!client) return { ok: false, reason: "not_found" };
  const ids = client.projects.map((p) => p.id);
  const blockers = await countBlockers(ids);
  if (!isClear(blockers)) return { ok: false, reason: "blocked", blockers };

  try {
    await db.$transaction(async (tx) => {
      // Checked again inside the transaction: a sign-off landing between the
      // first look and this delete must win, not lose.
      const again = await countBlockers(ids, tx);
      if (!isClear(again)) throw new Blocked(again);

      if (ids.length > 0) {
        const inIds = Prisma.join(ids);
        await tx.activityEvent.deleteMany({ where: { projectId: { in: ids } } });
        await tx.update.deleteMany({ where: { projectId: { in: ids } } });
        await tx.referral.deleteMany({ where: { projectId: { in: ids } } });
        await tx.oneTimeCode.deleteMany({ where: { projectId: { in: ids } } });
        // Append-only for a living record; see the note at the top.
        await tx.$executeRaw`DELETE FROM AgreementNote WHERE projectId IN (${inIds})`;
        await tx.agreement.deleteMany({ where: { projectId: { in: ids } } });
        await tx.project.deleteMany({ where: { clientId } });
      }
      await tx.clientNotification.deleteMany({ where: { clientId } });
      await tx.clientSession.deleteMany({ where: { clientId } });
      await tx.oneTimeCode.deleteMany({ where: { clientId } });
      await tx.intakeFile.deleteMany({ where: { clientId } });
      // Append-only for a living record; see the note at the top.
      await tx.$executeRaw`DELETE FROM IntakeChangeRequest WHERE clientId = ${clientId}`;
      await tx.$executeRaw`DELETE FROM IntakeVersion WHERE clientId = ${clientId}`;
      await tx.intake.deleteMany({ where: { clientId } });
      await tx.client.delete({ where: { id: clientId } });
    });
  } catch (error) {
    if (error instanceof Blocked) return { ok: false, reason: "blocked", blockers: error.blockers };
    throw error;
  }

  // The uploads on disk, after the rows are gone. Best effort: a file that
  // will not unlink is an orphan on disk, not a client that still exists.
  for (const f of client.files) await removeStored(f.storedPath);

  try {
    await emit({
      type: "client.removed",
      projectId: null,
      actor: actor.adminName,
      payload: { businessName: client.businessName, projects: ids.length, reason, by: actor.adminName },
    });
  } catch (error) {
    await requestLogger.error("client removed but the event was not written", { clientId, error: safeError(error) });
  }
  return { ok: true, businessName: client.businessName, projects: ids.length };
}
