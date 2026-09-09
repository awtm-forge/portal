import { IntakeChangeStatus, IntakeParty } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { emit } from "@/modules/events";

/**
 * ADR 0016. After the questionnaire is sent it is locked. The client asks to
 * change something, in a line; the team opens it or declines with a line the
 * client reads; sending the changes closes the request as a new version.
 * The team can open it without being asked, for a correction from a call.
 *
 * One request is live at a time. There is no thread and no reply field
 * beyond the one line each way: Rahul answers on WhatsApp, as he does for
 * the agreement.
 */
export type ChangeRequest = {
  id: string;
  status: IntakeChangeStatus;
  note: string;
  askedBy: IntakeParty;
  askedAt: Date;
  decidedAt: Date | null;
  reply: string | null;
  sentAt: Date | null;
  version: number | null;
};

export type IntakeState =
  /** Never sent: the client is still filling it in. */
  | { kind: "open" }
  /** Sent, read-only, nothing asked. */
  | { kind: "locked"; declined: ChangeRequest | null }
  /** The client asked; the team has not answered yet. */
  | { kind: "asked"; request: ChangeRequest }
  /** Open for a change, until the changes are sent. */
  | { kind: "changing"; request: ChangeRequest };

/** Newest first. */
export async function requestsFor(clientId: string): Promise<ChangeRequest[]> {
  const rows = await db.intakeChangeRequest.findMany({ where: { clientId }, orderBy: { askedAt: "desc" } });
  return rows.map(strip);
}

function strip(r: { id: string; status: IntakeChangeStatus; note: string; askedBy: IntakeParty; askedAt: Date; decidedAt: Date | null; reply: string | null; sentAt: Date | null; version: number | null }): ChangeRequest {
  return { id: r.id, status: r.status, note: r.note, askedBy: r.askedBy, askedAt: r.askedAt, decidedAt: r.decidedAt, reply: r.reply, sentAt: r.sentAt, version: r.version };
}

/** What the questionnaire is doing right now, from its row and its requests. */
export function stateOf(intake: { submittedAt: Date | null }, requests: ChangeRequest[]): IntakeState {
  if (!intake.submittedAt) return { kind: "open" };
  const newest = requests[0];
  if (newest?.status === IntakeChangeStatus.OPEN) return { kind: "changing", request: newest };
  if (newest?.status === IntakeChangeStatus.ASKED) return { kind: "asked", request: newest };
  return { kind: "locked", declined: newest?.status === IntakeChangeStatus.DECLINED ? newest : null };
}

export async function intakeState(clientId: string): Promise<IntakeState> {
  const intake = await db.intake.findUnique({ where: { clientId }, select: { submittedAt: true } });
  if (!intake) return { kind: "open" };
  return stateOf(intake, await requestsFor(clientId));
}

export type AskResult = { ok: true; id: string } | { ok: false; reason: "empty" | "not_sent" | "already_asked" | "already_open" };

/** The client's side. One line on what needs changing; nothing else is asked for. */
export async function askForChange(clientId: string, rawNote: string): Promise<AskResult> {
  const note = rawNote.trim().slice(0, 2000);
  if (!note) return { ok: false, reason: "empty" };
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM Intake WHERE clientId = ${clientId} FOR UPDATE`;
    const intake = await tx.intake.findUnique({ where: { clientId }, include: { client: { select: { businessName: true, contactName: true } } } });
    if (!intake?.submittedAt) return { ok: false as const, reason: "not_sent" as const };
    const live = await tx.intakeChangeRequest.findFirst({ where: { clientId, status: { in: [IntakeChangeStatus.ASKED, IntakeChangeStatus.OPEN] } } });
    if (live?.status === IntakeChangeStatus.ASKED) return { ok: false as const, reason: "already_asked" as const };
    if (live?.status === IntakeChangeStatus.OPEN) return { ok: false as const, reason: "already_open" as const };
    const row = await tx.intakeChangeRequest.create({ data: { clientId, note, askedBy: IntakeParty.CLIENT } });
    return { ok: true as const, id: row.id, businessName: intake.client.businessName, contactName: intake.client.contactName };
  });
  if (result.ok) {
    await emit({
      type: "intake.change_asked",
      projectId: null,
      actor: "client",
      payload: { clientId, businessName: result.businessName, contactName: result.contactName, note },
    });
  }
  return result.ok ? { ok: true, id: result.id } : result;
}

export type DecideResult = { ok: true } | { ok: false; reason: "no_request" | "not_asked" | "empty_reply" | "not_sent" | "already_open" };

/**
 * Opens the questionnaire for a change. With a request id, it answers the
 * client's ask; without one, the team is opening it on its own, and the note
 * says why for the record.
 */
export async function openForChanges(clientId: string, adminId: string, requestId: string | null, teamNote = ""): Promise<DecideResult> {
  const result = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM Intake WHERE clientId = ${clientId} FOR UPDATE`;
    const intake = await tx.intake.findUnique({ where: { clientId }, select: { submittedAt: true } });
    if (!intake?.submittedAt) return { ok: false as const, reason: "not_sent" as const };
    const open = await tx.intakeChangeRequest.findFirst({ where: { clientId, status: IntakeChangeStatus.OPEN } });
    if (open) return { ok: false as const, reason: "already_open" as const };
    const now = new Date();
    if (requestId) {
      const asked = await tx.intakeChangeRequest.findFirst({ where: { id: requestId, clientId } });
      if (!asked) return { ok: false as const, reason: "no_request" as const };
      if (asked.status !== IntakeChangeStatus.ASKED) return { ok: false as const, reason: "not_asked" as const };
      await tx.intakeChangeRequest.update({ where: { id: asked.id }, data: { status: IntakeChangeStatus.OPEN, decidedAt: now, decidedById: adminId } });
      return { ok: true as const, id: asked.id, by: "client" as const };
    }
    const row = await tx.intakeChangeRequest.create({
      data: { clientId, note: teamNote.trim().slice(0, 2000), askedBy: IntakeParty.TEAM, status: IntakeChangeStatus.OPEN, decidedAt: now, decidedById: adminId },
    });
    return { ok: true as const, id: row.id, by: "team" as const };
  });
  if (result.ok) {
    await emit({ type: "intake.change_opened", projectId: null, actor: `admin:${adminId}`, payload: { clientId, requestId: result.id, askedBy: result.by } });
  }
  return result.ok ? { ok: true } : result;
}

/** Declining needs the line the client will read. There is no silent no. */
export async function declineChange(clientId: string, adminId: string, requestId: string, rawReply: string): Promise<DecideResult> {
  const reply = rawReply.trim().slice(0, 2000);
  if (!reply) return { ok: false, reason: "empty_reply" };
  const result = await db.$transaction(async (tx) => {
    const asked = await tx.intakeChangeRequest.findFirst({ where: { id: requestId, clientId } });
    if (!asked) return { ok: false as const, reason: "no_request" as const };
    if (asked.status !== IntakeChangeStatus.ASKED) return { ok: false as const, reason: "not_asked" as const };
    await tx.intakeChangeRequest.update({ where: { id: asked.id }, data: { status: IntakeChangeStatus.DECLINED, decidedAt: new Date(), decidedById: adminId, reply } });
    return { ok: true as const };
  });
  if (result.ok) {
    await emit({ type: "intake.change_declined", projectId: null, actor: `admin:${adminId}`, payload: { clientId, requestId } });
  }
  return result;
}
