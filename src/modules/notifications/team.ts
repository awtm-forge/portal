/**
 * What the team is told, and where they read it back (ADR 0020).
 *
 * One mapper, two audiences for the same sentence: the email that goes to
 * TEAM_NOTIFY_EMAIL and the feed inside the admin. They cannot drift, because
 * the email is built from this and so is the page.
 *
 * There is no notification table. Every one of these moments is already an
 * activity event, which is the record; the feed reads that log, and each
 * admin keeps one timestamp saying how far down it they have read.
 */
import { db } from "@/lib/db";
import type { Activity, ActivityPayload, EventType } from "@/modules/events";

export type TeamNotice = { subject: string; body: string; path: string };

/** Where in the admin this event is dealt with. Relative: the email adds the host. */
export function teamPath(projectId: string | null, clientId?: unknown): string {
  if (projectId) return `/admin/projects/${projectId}`;
  // The questionnaire belongs to the client and usually has no project yet.
  if (typeof clientId === "string" && clientId) return `/admin/clients/${clientId}`;
  return "/admin";
}

/**
 * One line each, plain words (CLAUDE.md section 5: name the project and the
 * event). Null for anything that is the team's own doing: they were there.
 */
export function teamNotice(type: EventType, payload: ActivityPayload, projectId: string | null): TeamNotice | null {
  const p = payload;
  const name = typeof p.projectName === "string" ? p.projectName : "A project";
  const business = typeof p.businessName === "string" ? ` (${p.businessName})` : "";
  const who = typeof p.businessName === "string" ? p.businessName : "A client";
  const path = teamPath(projectId, p.clientId);

  switch (type) {
    case "intake.submitted":
      return { subject: `${name}: questionnaire sent`, body: `${name}${business} finished the questionnaire.`, path };
    case "intake.change_asked":
      return {
        subject: `${who}: asked to change the questionnaire`,
        body: `${who} asked to change something on the questionnaire:\n\n${typeof p.note === "string" ? p.note : ""}\n\nOpen it for them, or decline with a line, from their page.`,
        path,
      };
    case "intake.changes_sent": {
      const n = typeof p.changed === "number" ? p.changed : 0;
      return {
        subject: `${who}: questionnaire changed`,
        body: `${who} sent their changes: ${n} ${n === 1 ? "answer" : "answers"} changed, now version ${String(p.version ?? "")}. The changed answers are marked on their page.`,
        path,
      };
    }
    case "agreement.note":
      return { subject: `${name}: something is off with the agreement`, body: `${name}${business} pushed back on version ${p.version}. The agreement is back in draft.`, path };
    case "agreement.agreed":
      return {
        subject: `${name}: agreed`,
        body: `${name}${business} agreed version ${p.version}, ${p.method === "WHATSAPP" ? "recorded from WhatsApp" : "in the portal"}. Total ${p.total}. The advance invoice is raised.`,
        path,
      };
    case "invoice.issued":
      return { subject: `${name}: invoice ${p.number}`, body: `${p.kindLabel ?? p.kind} invoice ${p.number} for ${p.amount}.`, path };
    case "review.changes_requested":
      return { subject: `${name}: changes requested`, body: `${name}${business} says something is off. Back to building.`, path };
    case "delivery.signed_off":
      return { subject: `${name}: delivered`, body: `${name}${business} signed off the delivery. The balance invoice is raised.`, path };
    case "thanks.sent":
      return { subject: `${name}: thank-you page`, body: `${name}${business} sent the thank-you page.`, path };
    case "day30.approved":
      return { subject: `${name}: day 30 done`, body: `${name}${business} gave the number and approved the quote.`, path };
    case "enquiry.received":
      return {
        subject: `Enquiry from ${p.name ?? "the site"}`,
        body: [
          `Name: ${p.name}`,
          `Business: ${p.business || "not given"}`,
          `Reach them: ${p.contact}`,
          `Budget: ${p.budget}`,
          `Ad spend: ${p.adSpend}`,
          "",
          "What is not working:",
          String(p.problem ?? ""),
        ].join("\n"),
        path,
      };
    default:
      return null;
  }
}

/** The same thing for a whole activity, which is what the email subscriber holds. */
export function noticeFor(a: Activity): TeamNotice | null {
  return teamNotice(a.type, a.payload, a.projectId ?? null);
}

/** Only the types the team is told about, so the query does not read the whole log. */
export const TEAM_TYPES: EventType[] = [
  "intake.submitted",
  "intake.change_asked",
  "intake.changes_sent",
  "agreement.note",
  "agreement.agreed",
  "invoice.issued",
  "review.changes_requested",
  "delivery.signed_off",
  "thanks.sent",
  "day30.approved",
  "enquiry.received",
];

export type TeamFeedItem = TeamNotice & { id: string; at: Date; unread: boolean };

/**
 * The feed, newest first. Unread is everything since this admin last opened
 * the page, so two admins each keep their own place without a row per person
 * per notification.
 */
export async function teamFeed(seenAt: Date | null, take = 60): Promise<TeamFeedItem[]> {
  const rows = await db.activityEvent.findMany({
    where: { type: { in: TEAM_TYPES } },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, type: true, payload: true, projectId: true, createdAt: true },
  });
  const items: TeamFeedItem[] = [];
  for (const r of rows) {
    const notice = teamNotice(r.type as EventType, (r.payload ?? {}) as ActivityPayload, r.projectId);
    if (!notice) continue;
    items.push({ ...notice, id: r.id, at: r.createdAt, unread: seenAt === null || r.createdAt > seenAt });
  }
  return items;
}

/** How many the bell shows. Counted, not fetched, because the bell is on every admin page. */
export async function teamUnreadCount(seenAt: Date | null): Promise<number> {
  return db.activityEvent.count({
    where: { type: { in: TEAM_TYPES }, ...(seenAt ? { createdAt: { gt: seenAt } } : {}) },
  });
}

export async function markTeamSeen(adminUserId: string): Promise<void> {
  await db.adminUser.update({ where: { id: adminUserId }, data: { notificationsSeenAt: new Date() } });
}
