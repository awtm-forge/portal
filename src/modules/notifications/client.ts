/**
 * What the client is told (Q19, ADR 0017). A subscriber on the activity
 * events: for the moments that concern the client it writes a notification
 * row, shown in the portal with an unread mark, and for the ones that ask them
 * to look or act it also emails them, linking to their page. The payloads are
 * serialized (ADR 0009), so an internal amount can never reach here.
 *
 * One notice is not an event: the month-on page opening is a date, not an
 * action, and there is no scheduler by design. `tellDay30Due` is written once,
 * the first time the client's page renders after the unlock.
 */
import { db } from "@/lib/db";
import { clientUrl } from "@/lib/request-origin";
import { requestLogger, safeError } from "@/lib/logger";
import { sendPlain } from "@/lib/mail";
import type { Activity, ActivityPayload, EventType } from "@/modules/events";

export type Notice = { subject: string; title: string; body: string; path: string; email: boolean };

/** Pure: the client-facing notice for an event, or null when it is not the client's concern. */
export function clientNotice(type: EventType, payload: ActivityPayload): Notice | null {
  const week = typeof payload.weekNumber === "number" ? payload.weekNumber : null;
  switch (type) {
    case "agreement.sent":
      return {
        subject: "Your agreement is ready",
        title: "Your agreement is ready to read",
        body: "One page: what we will build, what it costs, when it lands, and how you will check it. Read it and agree, or tell us what is off. Nothing is invoiced until you agree.",
        path: "/agreement",
        email: true,
      };
    case "update.sent":
      return {
        subject: week ? `Week ${week} update` : "A new update",
        title: week ? `This week's update is up, week ${week}` : "This week's update is up",
        body: "A short note on what moved, what is next, and anything we need from you.",
        path: "",
        email: true,
      };
    case "review.opened":
      return {
        subject: "Ready for you to check",
        title: "The work is ready for you to check",
        body: "Have a look at it against what you agreed to, then sign it off or tell us what is off. Nothing is invoiced until you are happy.",
        path: "/review",
        email: true,
      };
    case "intake.change_opened":
      return {
        subject: "Your questionnaire is open",
        title: "Your questionnaire is open for changes",
        body: "Tap an answer to change it, then press Send the changes at the bottom. It locks again after that.",
        path: "/intake",
        email: true,
      };
    case "intake.change_declined":
      return {
        subject: "About your questionnaire",
        title: "We could not open your questionnaire this time",
        body: "We have left the reason on your page. You can ask again any time.",
        path: "/intake",
        email: false,
      };
    default:
      return null;
  }
}

/** Pure: the month-on notice, so the wording is testable beside the others. */
export const DAY30_DUE: Notice = {
  subject: "One month on",
  title: "One month on: two things, under a minute",
  body: "How is the number now, and a line in your words. Then we leave you alone.",
  path: "/day30",
  email: true,
};

async function clientIdFor(activity: Activity): Promise<string | null> {
  const fromPayload = activity.payload.clientId;
  if (typeof fromPayload === "string" && fromPayload) return fromPayload;
  if (activity.projectId) {
    const project = await db.project.findUnique({ where: { id: activity.projectId }, select: { clientId: true } });
    return project?.clientId ?? null;
  }
  return null;
}

/** Writes the row, and emails when the notice asks for it. Throws; callers decide how loud. */
async function deliver(clientId: string, kind: string, notice: Notice): Promise<void> {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { contactEmail: true, contactName: true, businessName: true } });
  if (!client) return;

  await db.clientNotification.create({ data: { clientId, kind, title: notice.title, body: notice.body, path: notice.path } });

  if (notice.email) {
    const link = await clientUrl("/p/me");
    const firstName = client.contactName.trim().split(/\s+/)[0] || client.contactName;
    const text = [
      `Hello ${firstName},`,
      "",
      notice.body,
      "",
      "Open your page:",
      link,
      "",
      "It will ask for a six digit code the first time on a new phone or laptop. That code comes to this address. There is no password, and there never will be one.",
      "",
      "Rahul",
      "awtm forge",
    ].join("\n");
    await sendPlain(client.contactEmail, `awtm forge, ${notice.subject}`, text);
  }
}

/** The subscriber. Best effort: a failure to tell the client never breaks the change that caused it. */
export async function tellClient(activity: Activity): Promise<void> {
  const notice = clientNotice(activity.type, activity.payload);
  if (!notice) return;
  try {
    const clientId = await clientIdFor(activity);
    if (!clientId) return;
    await deliver(clientId, activity.type, notice);
  } catch (error) {
    await requestLogger.error("client notification not sent", { type: activity.type, error: safeError(error) });
  }
}

/**
 * The month-on page has opened (F-16). Once per client: a second render while
 * the first is still writing could double it, which is harmless and rare.
 */
export async function tellDay30Due(clientId: string): Promise<void> {
  try {
    const already = await db.clientNotification.findFirst({ where: { clientId, kind: "day30.due" }, select: { id: true } });
    if (already) return;
    await deliver(clientId, "day30.due", DAY30_DUE);
  } catch (error) {
    await requestLogger.error("client notification not sent", { type: "day30.due", error: safeError(error) });
  }
}

export async function unreadCount(clientId: string): Promise<number> {
  return db.clientNotification.count({ where: { clientId, readAt: null } });
}

export async function listForClient(clientId: string, take = 30) {
  return db.clientNotification.findMany({ where: { clientId }, orderBy: { createdAt: "desc" }, take });
}

export async function markAllRead(clientId: string): Promise<void> {
  await db.clientNotification.updateMany({ where: { clientId, readAt: null }, data: { readAt: new Date() } });
}
