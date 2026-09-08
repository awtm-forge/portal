/**
 * Every entity leaves the domain through one of these (ADR 0009, PORTAL-SPEC 5.13).
 *
 * The client and print shapes have no field for internal cost or internal
 * notes, so a route cannot leak one by forgetting: the type system refuses a
 * raw model. Formatting lives here too, because paise to rupees and UTC to
 * Asia/Kolkata belong at the same boundary.
 */
import type {
  AgreementModel,
  ClientModel,
  CompanyModel,
  InvoiceModel,
  ProjectModel,
  ReviewRoundModel,
  SignoffEventModel,
  TestimonialModel,
  UpdateModel,
} from "@/generated/prisma/models";
import { dayMonthYear, isoDate } from "@/lib/dates";
import { amountInWords, formatRupees, splitAdvance } from "@/lib/money";

export type Deliverable = { key: string; text: string; how_to_check: string };
export type Milestone = { label: string; date: string };

export function readDeliverables(json: unknown): Deliverable[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((d) => {
    if (!d || typeof d !== "object") return [];
    const r = d as Record<string, unknown>;
    if (typeof r.key !== "string" || typeof r.text !== "string") return [];
    return [{ key: r.key, text: r.text, how_to_check: typeof r.how_to_check === "string" ? r.how_to_check : "" }];
  });
}

export function readMilestones(json: unknown): Milestone[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((m) => {
    if (!m || typeof m !== "object") return [];
    const r = m as Record<string, unknown>;
    if (typeof r.label !== "string" || typeof r.date !== "string") return [];
    return [{ label: r.label, date: r.date }];
  });
}

/** What a client or a print route may see of an agreement. No internal fields exist here. */
export type AgreementClientView = {
  id: string;
  version: number;
  scope: string;
  deliverables: Deliverable[];
  notIncluded: string;
  startDate: string | null;
  launchTargetDate: string | null;
  milestones: Milestone[];
  total: string;
  advancePct: number;
  advance: string;
  balance: string;
  howWeWork: string;
  ifWeMiss: string;
  afterDeliveryOffer: string;
  sentAt: string | null;
  agreedAt: string | null;
  agreedByName: string | null;
  agreedMethod: "PORTAL" | "WHATSAPP" | null;
  isAgreed: boolean;
};

export function agreementToClientView(a: AgreementModel): AgreementClientView {
  const { advance, balance } = splitAdvance(a.totalPaise, a.advancePct);
  return {
    id: a.id,
    version: a.version,
    scope: a.scope,
    deliverables: readDeliverables(a.deliverables),
    notIncluded: a.notIncluded,
    startDate: a.startDate ? dayMonthYear(a.startDate) : null,
    launchTargetDate: a.launchTargetDate ? dayMonthYear(a.launchTargetDate) : null,
    milestones: readMilestones(a.milestones),
    total: formatRupees(a.totalPaise),
    advancePct: a.advancePct,
    advance: formatRupees(advance),
    balance: formatRupees(balance),
    howWeWork: a.howWeWork,
    ifWeMiss: a.ifWeMiss,
    afterDeliveryOffer: a.afterDeliveryOffer,
    sentAt: a.sentAt ? dayMonthYear(a.sentAt) : null,
    agreedAt: a.agreedAt ? dayMonthYear(a.agreedAt) : null,
    agreedByName: a.agreedByName,
    agreedMethod: a.agreedMethod,
    isAgreed: a.agreedAt !== null,
  };
}

/** The print shape is the client shape. ADR 0007: one layout per document. */
export const agreementToPrintView = agreementToClientView;

/** Admin sees everything, with the internal block formatted for reading. */
export type AgreementAdminView = AgreementClientView & {
  internalCost: string;
  internalCostPaise: string;
  internalNotes: string;
  totalPaiseRaw: string;
  marginPaise: string;
};

export function agreementToAdminView(a: AgreementModel): AgreementAdminView {
  return {
    ...agreementToClientView(a),
    internalCost: formatRupees(a.internalCostPaise),
    internalCostPaise: a.internalCostPaise.toString(),
    internalNotes: a.internalNotes,
    totalPaiseRaw: a.totalPaise.toString(),
    marginPaise: (a.totalPaise - a.internalCostPaise).toString(),
  };
}

export type InvoiceClientView = {
  id: string;
  number: string;
  kind: "ADVANCE" | "BALANCE" | "OTHER";
  kindLabel: string;
  description: string;
  issuedAt: string;
  issuedAtIso: string;
  amount: string;
  tax: string;
  total: string;
  totalInWords: string;
  status: "ISSUED" | "PAID" | "CANCELLED";
  statusLabel: string;
  paidAt: string | null;
};

const KIND_LABEL: Record<string, string> = { ADVANCE: "Advance", BALANCE: "Balance", OTHER: "Extra" };
const STATUS_LABEL: Record<string, string> = { ISSUED: "Issued", PAID: "Paid", CANCELLED: "Cancelled" };

export function invoiceToClientView(i: InvoiceModel): InvoiceClientView {
  return {
    id: i.id,
    number: i.number,
    kind: i.kind,
    kindLabel: KIND_LABEL[i.kind] ?? i.kind,
    description: i.description,
    issuedAt: dayMonthYear(i.issuedAt),
    issuedAtIso: isoDate(i.issuedAt),
    amount: formatRupees(i.amountPaise),
    tax: formatRupees(i.taxAmountPaise),
    total: formatRupees(i.totalPaise),
    totalInWords: amountInWords(i.totalPaise),
    status: i.status,
    statusLabel: STATUS_LABEL[i.status] ?? i.status,
    paidAt: i.paidAt ? dayMonthYear(i.paidAt) : null,
  };
}

export const invoiceToPrintView = invoiceToClientView;

export type CompanyPrintView = {
  name: string;
  address: string;
  email: string;
  phone: string;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  upiId: string | null;
  gstin: string | null;
};

export function companyToPrintView(c: CompanyModel | CompanyPrintView): CompanyPrintView {
  return {
    name: c.name,
    address: c.address,
    email: c.email,
    phone: c.phone,
    bankName: c.bankName,
    bankAccountName: c.bankAccountName,
    bankAccountNumber: c.bankAccountNumber,
    bankIfsc: c.bankIfsc,
    upiId: c.upiId,
    gstin: c.gstin,
  };
}

export type ProjectClientView = {
  id: string;
  name: string;
  businessName: string;
  contactName: string;
  signoffPersonName: string;
  phase: string;
  deliveredAt: string | null;
  weekCount: number | null;
};

export function projectToClientView(p: ProjectModel & { client: ClientModel }): ProjectClientView {
  return {
    id: p.id,
    name: p.name,
    businessName: p.client.businessName,
    contactName: p.client.contactName,
    signoffPersonName: p.signoffPersonName,
    phase: p.phase,
    deliveredAt: p.deliveredAt ? dayMonthYear(p.deliveredAt) : null,
    weekCount: p.weekCount,
  };
}

export type SignoffClientView = {
  kind: "AGREEMENT" | "DELIVERY";
  occurredAt: string;
  actorName: string;
  method: "PORTAL" | "WHATSAPP";
  agreementVersion: number | null;
};

export function signoffToClientView(s: SignoffEventModel): SignoffClientView {
  return {
    kind: s.kind,
    occurredAt: dayMonthYear(s.occurredAt),
    actorName: s.actorName,
    method: s.method,
    agreementVersion: s.agreementVersion,
  };
}

export type UpdateClientView = {
  id: string;
  weekNumber: number;
  sentAt: string;
  moved: string;
  nextUp: string;
  needFromYou: string;
  needByDate: string | null;
  risks: string;
  stagingUrl: string | null;
};

/** An update has no private half, so the client view is the whole row. */
export function updateToClientView(u: UpdateModel): UpdateClientView {
  return {
    id: u.id,
    weekNumber: u.weekNumber,
    sentAt: dayMonthYear(u.sentAt),
    moved: u.moved,
    nextUp: u.nextUp,
    needFromYou: u.needFromYou,
    needByDate: u.needByDate ? dayMonthYear(u.needByDate) : null,
    risks: u.risks.trim() ? u.risks : "None this week.",
    stagingUrl: u.stagingUrl,
  };
}

export type ReviewRoundClientView = {
  id: string;
  roundNumber: number;
  sentAt: string;
  finishedWorkUrl: string;
  clientNote: string | null;
  respondedAt: string | null;
  outcome: "OPEN" | "CHANGES_REQUESTED" | "ACCEPTED";
  outcomeLabel: string;
};

const OUTCOME_LABEL: Record<string, string> = {
  OPEN: "With you to check",
  CHANGES_REQUESTED: "You said something was off",
  ACCEPTED: "Signed off",
};

/** A review round has no private half: the client wrote most of it. */
export function reviewRoundToClientView(r: ReviewRoundModel): ReviewRoundClientView {
  return {
    id: r.id,
    roundNumber: r.roundNumber,
    sentAt: dayMonthYear(r.sentAt),
    finishedWorkUrl: r.finishedWorkUrl,
    clientNote: r.clientNote,
    respondedAt: r.respondedAt ? dayMonthYear(r.respondedAt) : null,
    outcome: r.outcome,
    outcomeLabel: OUTCOME_LABEL[r.outcome] ?? r.outcome,
  };
}

export type TestimonialAdminView = {
  id: string;
  moment: "DELIVERY" | "DAY30";
  momentLabel: string;
  text: string;
  status: "DRAFT" | "APPROVED";
  useName: boolean;
  useLogo: boolean;
  createdAt: string;
  approvedAt: string | null;
};

/**
 * Admin only, deliberately. There is no client or print view for a testimonial
 * or a referral, and that absence is what enforces acceptance criteria 25 and
 * 26: a leak would need someone to write a new function, not forget an
 * omission (ADR 0009).
 */
export function testimonialToAdminView(t: TestimonialModel): TestimonialAdminView {
  return {
    id: t.id,
    moment: t.moment,
    momentLabel: t.moment === "DELIVERY" ? "On delivery" : "At day 30",
    text: t.text,
    status: t.status,
    useName: t.useName,
    useLogo: t.useLogo,
    createdAt: dayMonthYear(t.createdAt),
    approvedAt: t.approvedAt ? dayMonthYear(t.approvedAt) : null,
  };
}
