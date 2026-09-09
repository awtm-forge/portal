/**
 * The needs-attention block (PORTAL-SPEC 6.6).
 *
 * Six things go quiet in six different ways, and all six are silence rather
 * than events: nobody submits a questionnaire late, they simply do not submit
 * it. So this is computed on read, from timestamps that already exist. There
 * is no reminder table, no job, and nothing to reconcile when a project moves.
 *
 * The thresholds are the spec's. They are here as named constants so a change
 * is one line and the reason it changed can sit beside it.
 */
import { InvoiceStatus, Phase } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export const DAYS = {
  intakeUnsubmitted: 5,
  agreementUnsigned: 5,
  noUpdateWhileBuilding: 8,
  reviewRoundOpen: 3,
  invoiceUnpaid: 7,
} as const;

export type Reason =
  | "intake_unsubmitted"
  | "agreement_unsigned"
  | "no_update"
  | "review_open"
  | "invoice_unpaid"
  | "day30_unopened";

export type Attention = {
  /** Null for a client who has no project yet: the link goes to the client. */
  projectId: string | null;
  clientId: string;
  projectName: string;
  businessName: string;
  reason: Reason;
  /** What to say, already written. The view puts it on the page and no more. */
  line: string;
  /** How long it has been quiet, for ordering. Longest first. */
  days: number;
};

function daysSince(at: Date, now: Date): number {
  return Math.floor((now.getTime() - at.getTime()) / 86_400_000);
}

const LIVE_PHASES = [
  Phase.INTAKE,
  Phase.AGREEMENT_DRAFT,
  Phase.AGREEMENT_SENT,
  Phase.AGREED,
  Phase.BUILDING,
  Phase.IN_REVIEW,
  Phase.DELIVERED,
] as const;

/**
 * Every project that has gone quiet, worst first. One read of the projects
 * and the rows that hang off them, then arithmetic: a list this size does not
 * need six queries, and the admin already loads most of it anyway.
 *
 * Cancelled and closed projects are left out. Nothing about them is waiting.
 */
export async function needsAttention(now: Date = new Date()): Promise<Attention[]> {
  const projects = await db.project.findMany({
    where: { phase: { in: [...LIVE_PHASES] } },
    include: {
      client: { select: { businessName: true } },
      agreement: { select: { sentAt: true, agreedAt: true } },
      updates: { where: { sentAt: { not: null } }, orderBy: { sentAt: "desc" }, take: 1, select: { sentAt: true } },
      reviewRounds: { where: { outcome: "OPEN" }, orderBy: { sentAt: "desc" }, take: 1, select: { sentAt: true } },
      invoices: { where: { status: InvoiceStatus.ISSUED }, orderBy: { issuedAt: "asc" }, select: { number: true, issuedAt: true } },
      day30: { select: { unlocksAt: true, openedAt: true, metricAfterSubmittedAt: true } },
    },
  });

  const out: Attention[] = [];
  const add = (p: (typeof projects)[number], reason: Reason, days: number, line: string) => {
    out.push({ projectId: p.id, clientId: p.clientId, projectName: p.name, businessName: p.client.businessName, reason, days, line });
  };

  // The questionnaire belongs to the client and is usually answered before
  // any project exists, so this one is counted from the questionnaire itself,
  // whether or not a project is waiting on it.
  const openQuestionnaires = await db.intake.findMany({
    where: { submittedAt: null, overriddenAt: null },
    include: { client: { select: { id: true, businessName: true, contactName: true } } },
  });
  for (const q of openQuestionnaires) {
    const d = daysSince(q.documentUploadedAt, now);
    if (d >= DAYS.intakeUnsubmitted) {
      out.push({
        projectId: null,
        clientId: q.client.id,
        projectName: `${q.client.businessName}, questionnaire`,
        businessName: q.client.contactName,
        reason: "intake_unsubmitted",
        days: d,
        line: `Questionnaire still open after ${d} days.`,
      });
    }
  }

  for (const p of projects) {

    if (p.phase === Phase.AGREEMENT_SENT && p.agreement?.sentAt && !p.agreement.agreedAt) {
      const d = daysSince(p.agreement.sentAt, now);
      if (d >= DAYS.agreementUnsigned) add(p, "agreement_unsigned", d, `Agreement sent ${d} days ago and not signed.`);
    }

    if (p.phase === Phase.BUILDING) {
      // No update at all yet counts from the kickoff, not from never.
      const since = p.updates[0]?.sentAt ?? p.kickoffAt ?? p.createdAt;
      const d = daysSince(since, now);
      if (d >= DAYS.noUpdateWhileBuilding) {
        add(p, "no_update", d, p.updates[0]?.sentAt ? `No weekly update for ${d} days.` : `Building for ${d} days with no update sent.`);
      }
    }

    const round = p.reviewRounds[0];
    if (p.phase === Phase.IN_REVIEW && round) {
      const d = daysSince(round.sentAt, now);
      if (d >= DAYS.reviewRoundOpen) add(p, "review_open", d, `Waiting on their review for ${d} days.`);
    }

    for (const invoice of p.invoices) {
      const d = daysSince(invoice.issuedAt, now);
      if (d >= DAYS.invoiceUnpaid) add(p, "invoice_unpaid", d, `${invoice.number} unpaid after ${d} days.`);
    }

    if (p.day30 && !p.day30.metricAfterSubmittedAt && !p.day30.openedAt && p.day30.unlocksAt <= now) {
      const d = daysSince(p.day30.unlocksAt, now);
      add(p, "day30_unopened", d, d === 0 ? "Day 30 opened today and has not been seen." : `Day 30 open ${d} days, not opened.`);
    }
  }

  return out.sort((a, b) => b.days - a.days);
}
