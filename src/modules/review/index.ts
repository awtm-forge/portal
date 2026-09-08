/**
 * The review loop (PORTAL-SPEC 5.5 and 5.6, docs/SEQUENCES.md diagram 3).
 *
 * Marking ready opens a round. The client either says what is off, which sends
 * the project back to building and costs them nothing, or signs the delivery
 * off, which is the second and last sign-off and the only thing that raises
 * the balance invoice. Every round is kept; there is no delete path.
 */
import {
  Phase,
  ReviewOutcome,
  SignoffKind,
  SignoffMethod,
  TestimonialMoment,
} from "@/generated/prisma/enums";
import type { ReviewRoundModel } from "@/generated/prisma/models";
import { db } from "@/lib/db";
import { addReferral, draftTestimonial, open as openDay30 } from "@/modules/day30";
import { emit } from "@/modules/events";
import { issueBalance, issuingContext } from "@/modules/invoices";
import { PhaseRaced, transition } from "@/modules/projects/phase";
import { agreementToClientView, readDeliverables } from "@/modules/serializers";

export type OpenRoundResult =
  | { ok: true; round: ReviewRoundModel }
  | { ok: false; reason: "wrong_phase" | "no_agreement" | "no_link" };

/**
 * Marking ready. The link is required: a review only happens once the work is
 * complete, so there is always somewhere to look at it.
 */
export async function openRound(projectId: string, finishedWorkUrl: string): Promise<OpenRoundResult> {
  const url = finishedWorkUrl.trim();
  if (!url) return { ok: false, reason: "no_link" };

  const result = await db.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: projectId }, include: { agreement: true } });
    if (!project) return { ok: false, reason: "wrong_phase" } as const;
    if (!project.agreement?.agreedAt) return { ok: false, reason: "no_agreement" } as const;
    if (project.phase !== Phase.BUILDING) return { ok: false, reason: "wrong_phase" } as const;

    const last = await tx.reviewRound.findFirst({ where: { projectId }, orderBy: { roundNumber: "desc" } });
    const round = await tx.reviewRound.create({
      data: { projectId, roundNumber: (last?.roundNumber ?? 0) + 1, finishedWorkUrl: url.slice(0, 500) },
    });
    await transition(tx, project, "marked_ready");
    return { ok: true, round, projectName: project.name } as const;
  }).catch((error) => {
    if (error instanceof PhaseRaced) return { ok: false, reason: "wrong_phase" } as const;
    throw error;
  });
  if (!result.ok) return result;

  await emit({
    type: "review.opened",
    projectId,
    actor: "team",
    payload: { round: result.round.roundNumber, projectName: result.projectName },
  });
  return { ok: true, round: result.round };
}

export type ChangesResult = { ok: true } | { ok: false; reason: "wrong_phase" | "no_round" | "empty" };

/**
 * What is off. No code is asked for: saying something is wrong should never be
 * harder than saying nothing, and nothing is invoiced either way.
 */
export async function requestChanges(projectId: string, text: string): Promise<ChangesResult> {
  const note = text.trim().slice(0, 8000);
  if (!note) return { ok: false, reason: "empty" };

  const result = await db.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: projectId }, include: { client: true } });
    if (!project || project.phase !== Phase.IN_REVIEW) return { ok: false, reason: "wrong_phase" } as const;
    const round = await tx.reviewRound.findFirst({
      where: { projectId, outcome: ReviewOutcome.OPEN },
      orderBy: { roundNumber: "desc" },
    });
    if (!round) return { ok: false, reason: "no_round" } as const;

    await tx.reviewRound.update({
      where: { id: round.id },
      data: { clientNote: note, respondedAt: new Date(), outcome: ReviewOutcome.CHANGES_REQUESTED },
    });
    await transition(tx, project, "changes_requested");
    return { ok: true, round: round.roundNumber, projectName: project.name, businessName: project.client.businessName } as const;
  }).catch((error) => {
    if (error instanceof PhaseRaced) return { ok: false, reason: "wrong_phase" } as const;
    throw error;
  });
  if (!result.ok) return result;

  await emit({
    type: "review.changes_requested",
    projectId,
    actor: "client",
    payload: { round: result.round, projectName: result.projectName, businessName: result.businessName },
  });
  return { ok: true };
}

export type SignOffResult =
  | { ok: true; invoiceNumber: string }
  | { ok: false; reason: "wrong_phase" | "no_round" | "no_agreement" | "already_delivered" };

/**
 * Delivery. Everything in one transaction: no sign-off without an invoice, no
 * invoice without a sign-off, and no number consumed unless both are written.
 * Mirrors agree() in modules/agreements, which is the reference for this.
 */
export async function signOffDelivery(args: {
  projectId: string;
  actorName: string;
  method: SignoffMethod;
  ip?: string | null;
  userAgent?: string | null;
  rawNote?: string | null;
  at?: Date;
}): Promise<SignOffResult> {
  const ctx = await issuingContext();
  const at = args.at ?? new Date();

  const result = await db.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: args.projectId },
      include: { agreement: true, client: true },
    });
    if (!project?.agreement?.agreedAt) return { ok: false, reason: "no_agreement" } as const;
    if (project.deliveredAt) return { ok: false, reason: "already_delivered" } as const;
    if (project.phase !== Phase.IN_REVIEW) return { ok: false, reason: "wrong_phase" } as const;

    const round = await tx.reviewRound.findFirst({
      where: { projectId: project.id, outcome: ReviewOutcome.OPEN },
      orderBy: { roundNumber: "desc" },
    });
    if (!round) return { ok: false, reason: "no_round" } as const;

    // First, so the conditional phase write is the mutual exclusion token for
    // everything below it. Two fast submits cannot both raise a balance.
    const t = await transition(tx, project, "delivery_signed_off");

    await tx.signoffEvent.create({
      data: {
        projectId: project.id,
        kind: SignoffKind.DELIVERY,
        occurredAt: at,
        method: args.method,
        actorName: args.actorName.slice(0, 120),
        ip: args.ip ?? null,
        userAgent: args.userAgent?.slice(0, 400) ?? null,
        rawNote: args.rawNote ?? null,
      },
    });
    const closed = await tx.reviewRound.updateMany({
      where: { id: round.id, outcome: ReviewOutcome.OPEN },
      data: { respondedAt: at, outcome: ReviewOutcome.ACCEPTED },
    });
    if (closed.count !== 1) throw new Error("the review round closed underneath the sign-off");
    await tx.project.update({ where: { id: project.id }, data: { deliveredAt: at } });

    if (!t.effects.includes("issue_balance_invoice")) {
      throw new Error("the delivery transition no longer raises the balance");
    }
    const invoice = await issueBalance(tx, {
      projectId: project.id,
      projectName: project.name,
      totalPaise: project.agreement.totalPaise,
      advancePct: project.agreement.advancePct,
      prefix: ctx.prefix,
      gstin: ctx.gstin,
      at,
    });
    if (t.effects.includes("open_day30")) await openDay30(tx, project.id, at);
    // The "after_delivery" effect is discharged at render time, not by a write:
    // the retainer and handover fields already sit on the project and the
    // delivered page reads them. It stays in the table because the spec names
    // it and a complete description is worth more than a tidy one.

    return {
      ok: true,
      invoiceNumber: invoice.number,
      view: agreementToClientView(project.agreement),
      projectName: project.name,
      businessName: project.client.businessName,
    } as const;
  }).catch((error) => {
    // Lost the race to another sign-off. From here that is indistinguishable
    // from arriving after it was already delivered, and reads better.
    if (error instanceof PhaseRaced) return { ok: false, reason: "already_delivered" } as const;
    throw error;
  });
  if (!result.ok) return result;

  await emit({
    type: "delivery.signed_off",
    projectId: args.projectId,
    actor: args.actorName,
    payload: { method: args.method, projectName: result.projectName, businessName: result.businessName },
  });
  await emit({
    type: "invoice.issued",
    projectId: args.projectId,
    actor: "system",
    payload: { number: result.invoiceNumber, kind: "BALANCE", kindLabel: "Balance", amount: result.view.balance },
  });
  return { ok: true, invoiceNumber: result.invoiceNumber };
}

/** The thank-you page. Submitting nothing is allowed, and is still recorded. */
export async function recordThanks(
  projectId: string,
  input: { quote?: string; referralName?: string; referralContact?: string },
): Promise<void> {
  const quote = (input.quote ?? "").trim();
  if (quote) await draftTestimonial(projectId, TestimonialMoment.DELIVERY, quote);
  await addReferral(projectId, input.referralName ?? "", input.referralContact ?? "");
  await db.project.update({ where: { id: projectId }, data: { thanksSeenAt: new Date() } });
  await emit({
    type: "thanks.sent",
    projectId,
    actor: "client",
    payload: { gaveQuote: quote.length > 0, gaveReferral: Boolean((input.referralName ?? "").trim() || (input.referralContact ?? "").trim()) },
  });
}

/** Skipping is recorded too, so a decline is not the same as never arriving. */
export async function skipThanks(projectId: string): Promise<void> {
  await db.project.update({ where: { id: projectId }, data: { thanksSeenAt: new Date() } });
}

export function roundsForProject(projectId: string) {
  return db.reviewRound.findMany({ where: { projectId }, orderBy: { roundNumber: "desc" } });
}

export function openRoundFor(projectId: string) {
  return db.reviewRound.findFirst({
    where: { projectId, outcome: ReviewOutcome.OPEN },
    orderBy: { roundNumber: "desc" },
  });
}

/** How many things the client is checking, for the WhatsApp message. */
export function deliverableCount(deliverables: unknown): number {
  return readDeliverables(deliverables).length;
}
