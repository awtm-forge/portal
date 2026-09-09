/**
 * The agreement (PORTAL-SPEC 5.3, 5.4, 6.3, and CLAUDE.md 5.1).
 *
 * Two rules do the work here. The agreement cannot be sent until the intake is
 * submitted or an admin records an override. And agreeing freezes everything:
 * after agreedAt is set there is no path in this module that writes to the row.
 */
import { CodePurpose, InvoiceKind, Phase, SignoffKind, SignoffMethod } from "@/generated/prisma/enums";
import type { AgreementModel } from "@/generated/prisma/models";
import { db } from "@/lib/db";
import { emit } from "@/modules/events";
import { issueAdvance, issuingContext } from "@/modules/invoices";
import { PhaseRaced, transition } from "@/modules/projects/phase";
import { agreementToClientView } from "@/modules/serializers";

export class AgreementFrozen extends Error {
  constructor() {
    super("This agreement was agreed and cannot be changed. New work is a new agreement.");
    this.name = "AgreementFrozen";
  }
}

export type AgreementDraft = {
  scope: string;
  deliverables: { key: string; text: string; how_to_check: string }[];
  notIncluded: string;
  startDate: Date | null;
  launchTargetDate: Date | null;
  milestones: { label: string; date: string }[];
  totalPaise: bigint;
  advancePct: number;
  howWeWork: string;
  ifWeMiss: string;
  afterDeliveryOffer: string;
  internalCostPaise: bigint;
  internalNotes: string;
};

/** Creates or updates the draft. Refuses once agreed. PORTAL-SPEC 5.4. */
export async function saveDraft(projectId: string, draft: AgreementDraft): Promise<AgreementModel> {
  const existing = await db.agreement.findUnique({ where: { projectId } });
  if (existing?.agreedAt) throw new AgreementFrozen();
  const data = {
    scope: draft.scope,
    deliverables: draft.deliverables,
    notIncluded: draft.notIncluded,
    startDate: draft.startDate,
    launchTargetDate: draft.launchTargetDate,
    milestones: draft.milestones,
    totalPaise: draft.totalPaise,
    advancePct: draft.advancePct,
    howWeWork: draft.howWeWork,
    ifWeMiss: draft.ifWeMiss,
    afterDeliveryOffer: draft.afterDeliveryOffer,
    internalCostPaise: draft.internalCostPaise,
    internalNotes: draft.internalNotes,
  };
  if (!existing) return db.agreement.create({ data: { projectId, ...data } });
  return db.agreement.update({ where: { projectId }, data });
}

export type SendResult = { ok: true; version: number } | { ok: false; reason: "no_agreement" | "intake_open" | "frozen" | "wrong_phase" };

/**
 * PORTAL-SPEC 5.3 and 5.4. Sending from a draft that was already sent once
 * increments the version, which is what a client's push-back leads to.
 */
export async function send(projectId: string): Promise<SendResult> {
  return db.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: { client: { include: { intake: true } }, agreement: true },
    });
    if (!project?.agreement) return { ok: false, reason: "no_agreement" } as const;
    if (project.agreement.agreedAt) return { ok: false, reason: "frozen" } as const;
    const intake = project.client.intake;
    const submitted = intake?.submittedAt !== null && intake?.submittedAt !== undefined;
    const overridden = intake?.overriddenAt !== null && intake?.overriddenAt !== undefined;
    if (!submitted && !overridden) return { ok: false, reason: "intake_open" } as const;
    if (project.phase !== Phase.AGREEMENT_DRAFT) return { ok: false, reason: "wrong_phase" } as const;

    const resent = project.agreement.sentAt !== null;
    const version = resent ? project.agreement.version + 1 : project.agreement.version;
    await tx.agreement.update({ where: { projectId }, data: { sentAt: new Date(), version } });
    await transition(tx, project, "agreement_sent");
    return { ok: true, version } as const;
  });
}

/** INTAKE-SPEC 13.3: the override records who and when. */
export async function overrideIntakeGate(projectId: string, adminId: string): Promise<boolean> {
  const project = await db.project.findUnique({ where: { id: projectId }, include: { client: { include: { intake: true } } } });
  const intake = project?.client.intake;
  if (!project || !intake || project.phase !== Phase.INTAKE) return false;
  await db.$transaction(async (tx) => {
    await tx.intake.update({ where: { id: intake.id }, data: { overriddenAt: new Date(), overriddenById: adminId } });
    await transition(tx, project, "intake_overridden");
  });
  await emit({ type: "intake.overridden", projectId, actor: adminId, payload: {} });
  return true;
}

export type AgreeResult =
  | { ok: true; invoiceNumber: string }
  | { ok: false; reason: "wrong_phase" | "no_agreement" | "already_agreed" };

/**
 * The sign-off, docs/SEQUENCES.md 2. Everything in one transaction: no
 * sign-off without an invoice, no invoice without a sign-off, and no number
 * consumed unless both are written.
 */
export async function agree(args: {
  projectId: string;
  actorName: string;
  method: SignoffMethod;
  ip?: string | null;
  userAgent?: string | null;
  rawNote?: string | null;
  at?: Date;
}): Promise<AgreeResult> {
  const ctx = await issuingContext();
  const at = args.at ?? new Date();

  // A caller that lost the phase race is, from its own point of view, acting
  // on a project that has moved on. Report it the same way, rather than
  // letting a stack trace reach whoever clicked twice.
  const result = await db.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: args.projectId }, include: { agreement: true } });
    if (!project?.agreement) return { ok: false, reason: "no_agreement" } as const;
    if (project.agreement.agreedAt) return { ok: false, reason: "already_agreed" } as const;
    if (project.phase !== Phase.AGREEMENT_SENT) return { ok: false, reason: "wrong_phase" } as const;

    // First, so the conditional phase write is the mutual exclusion token for
    // everything below it. See transition() in modules/projects/phase.
    const t = await transition(tx, project, "agreement_agreed");

    await tx.signoffEvent.create({
      data: {
        projectId: project.id,
        kind: SignoffKind.AGREEMENT,
        occurredAt: at,
        method: args.method,
        actorName: args.actorName.slice(0, 120),
        ip: args.ip ?? null,
        userAgent: args.userAgent?.slice(0, 400) ?? null,
        rawNote: args.rawNote ?? null,
        agreementVersion: project.agreement.version,
      },
    });
    await tx.agreement.update({
      where: { projectId: project.id },
      data: { agreedAt: at, agreedByName: args.actorName.slice(0, 120), agreedMethod: args.method },
    });
    if (!t.effects.includes("issue_advance_invoice")) {
      throw new Error("the agreement transition no longer raises the advance");
    }
    const invoice = await issueAdvance(tx, {
      projectId: project.id,
      totalPaise: project.agreement.totalPaise,
      advancePct: project.agreement.advancePct,
      prefix: ctx.prefix,
      gstin: ctx.gstin,
      at,
    });
    return { ok: true, invoiceNumber: invoice.number, view: agreementToClientView(project.agreement) } as const;
  }).catch((error) => {
    if (error instanceof PhaseRaced) return { ok: false, reason: "already_agreed" } as const;
    throw error;
  });

  if (!result.ok) return result;

  await emit({
    type: "agreement.agreed",
    projectId: args.projectId,
    actor: args.actorName,
    payload: { method: args.method, version: result.view.version, total: result.view.total },
  });
  await emit({
    type: "invoice.issued",
    projectId: args.projectId,
    actor: "system",
    payload: { number: result.invoiceNumber, kind: InvoiceKind.ADVANCE, amount: result.view.advance },
  });
  return { ok: true, invoiceNumber: result.invoiceNumber };
}

export type NoteResult = { ok: true } | { ok: false; reason: "wrong_phase" | "empty" };

/**
 * CLAUDE.md 5.1: the client can push back inside the portal, with no code.
 * It moves the phase back to draft and the note is append-only. There is no
 * reply field: Rahul answers by editing the agreement or on WhatsApp.
 */
export async function addClientNote(projectId: string, text: string): Promise<NoteResult> {
  const trimmed = text.trim().slice(0, 8000);
  if (!trimmed) return { ok: false, reason: "empty" };

  const result = await db.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: projectId }, include: { agreement: true } });
    if (!project?.agreement || project.phase !== Phase.AGREEMENT_SENT) return { ok: false, reason: "wrong_phase" } as const;
    await tx.agreementNote.create({
      data: { projectId, agreementVersion: project.agreement.version, text: trimmed, enteredBy: "client" },
    });
    await transition(tx, project, "agreement_note");
    return { ok: true, version: project.agreement.version } as const;
  });
  if (!result.ok) return result;

  await emit({ type: "agreement.note", projectId, actor: "client", payload: { version: result.version } });
  return { ok: true };
}

/** The purpose a sign-off code must carry, so a login code cannot agree. */
export const AGREEMENT_CODE_PURPOSE = CodePurpose.AGREEMENT;
