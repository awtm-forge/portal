/**
 * The client: the record that exists before any project does, and the owner
 * of the link and the questionnaire (ADR 0015, QUESTIONS.md Q12).
 *
 * Creating a client mints their link. Sending the questionnaire attaches the
 * document and emails that link. Starting a project later puts the project on
 * the same link. Nothing here knows about HTTP or React.
 */
import { Phase } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { seal } from "@/lib/seal";
import { safeError } from "@/lib/logger";
import { requestLogger } from "@/lib/logger";
import { mintToken, rotateClientToken } from "@/modules/auth/client";
import { clientUrl } from "@/lib/request-origin";
import { emit } from "@/modules/events";
import type { IntakeDocument } from "@/modules/intake/document";
import { upsertDocument } from "@/modules/intake/replace";
import { sendLinkEmail } from "@/modules/notifications";

export type NewClient = {
  businessName: string;
  location: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

/** Makes the client and mints their link. The token is returned once. */
export async function createClient(input: NewClient): Promise<{ id: string; token: string }> {
  const { token, tokenHash } = mintToken();
  const client = await db.client.create({
    data: { ...input, contactEmail: input.contactEmail.toLowerCase(), accessTokenHash: tokenHash, accessTokenSealed: seal(token) },
  });
  await emit({ type: "client.created", projectId: null, actor: "team", payload: { clientId: client.id, businessName: client.businessName } });
  return { id: client.id, token };
}

/** Emails the link and records the outcome. A failure never blocks anything. */
export async function deliverLink(clientId: string, token: string): Promise<boolean> {
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) return false;
  try {
    await sendLinkEmail({
      to: client.contactEmail,
      contactName: client.contactName,
      businessName: client.businessName,
      link: await clientUrl(`/p/${token}`),
    });
    await db.client.update({ where: { id: clientId }, data: { linkEmailedAt: new Date(), linkEmailError: null } });
    await emit({ type: "client.link_emailed", projectId: null, actor: "system", payload: { clientId } });
    return true;
  } catch (error) {
    await requestLogger.error("link email failed", { clientId, error: safeError(error) });
    await db.client.update({ where: { id: clientId }, data: { linkEmailError: safeError(error).slice(0, 300) } });
    return false;
  }
}

/**
 * Attaches the document, or replaces it. Emailing the link is the caller's
 * choice, because a replacement mid-way should not mail them again.
 */
export async function sendQuestionnaire(clientId: string, document: IntakeDocument, adminId: string) {
  const result = await upsertDocument(clientId, document, adminId);
  await emit({ type: "intake.sent", projectId: null, actor: "team", payload: { clientId } });
  return result;
}

/** A new link. The old one, every session and every open code stop at once. */
export async function rotateLink(clientId: string): Promise<string> {
  return rotateClientToken(clientId);
}

export function byId(clientId: string) {
  return db.client.findUnique({ where: { id: clientId } });
}

export function withProjects(clientId: string) {
  return db.client.findUnique({
    where: { id: clientId },
    include: {
      projects: { orderBy: { createdAt: "desc" } },
      intake: { include: { documentUploadedBy: { select: { name: true } } } },
    },
  });
}

export function withIntake(clientId: string) {
  return db.client.findUnique({ where: { id: clientId }, include: { intake: true } });
}

export function listForAdmin() {
  return db.client.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      projects: { orderBy: { createdAt: "desc" } },
      intake: { select: { submittedAt: true, lastSavedAt: true, document: true, answers: true, sectionsDone: true } },
    },
  });
}

const OVER = [Phase.CLOSED, Phase.CANCELLED] as const;

/**
 * The project a client's page is about: the newest one still going. When
 * nothing is going, the newest one there was, because a closed project stays
 * readable at the same link for good (PORTAL-SPEC 6.1) and the page must
 * have something to show. Null only while there has never been a project.
 */
export async function activeProjectFor(clientId: string) {
  const include = { agreement: true, day30: true } as const;
  const live = await db.project.findFirst({
    where: { clientId, phase: { notIn: [...OVER] } },
    orderBy: { createdAt: "desc" },
    include,
  });
  if (live) return live;
  return db.project.findFirst({ where: { clientId }, orderBy: { createdAt: "desc" }, include });
}

/** Every project a client has had, newest first, for the record below the fold. */
export function projectsFor(clientId: string) {
  return db.project.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } });
}

/**
 * Which pages exist for a client, for the row of links under the header
 * (QUESTIONS.md Q15). A page is listed once there is something on it, and
 * the review only while one is open.
 */
export type ClientNav = { questionnaire: boolean; agreement: boolean; invoices: boolean; review: boolean };

export async function navFor(clientId: string): Promise<ClientNav> {
  const project = await activeProjectFor(clientId);
  const [intake, invoices] = await Promise.all([
    db.intake.findUnique({ where: { clientId }, select: { id: true } }),
    project ? db.invoice.count({ where: { projectId: project.id } }) : Promise.resolve(0),
  ]);
  return {
    questionnaire: intake !== null,
    agreement: Boolean(project?.agreement?.sentAt),
    invoices: invoices > 0,
    review: project?.phase === Phase.IN_REVIEW,
  };
}

