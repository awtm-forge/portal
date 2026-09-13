/**
 * Everything that tells a person something (ADR 0006). Subscribers listen to
 * activity events; nothing in the module that made a change calls an email
 * function directly. A new side effect is a new case here.
 *
 * Payloads reach here already serialized, so no template can carry internal
 * cost even by accident (PORTAL-SPEC 5.13).
 */
import { adminBase } from "@/lib/hosts";
import { requestLogger, safeError } from "@/lib/logger";
import { sendPlain, teamNotifyAddress } from "@/lib/mail";
import { subscribe, type Activity } from "@/modules/events";
import { tellClient } from "@/modules/notifications/client";
import { noticeFor } from "@/modules/notifications/team";

/**
 * The team's email. The sentence itself comes from modules/notifications/team,
 * which the admin's own notification page reads too, so the two say the same
 * thing (ADR 0020). Only the host is added here: team links go to the team
 * host, a different name from the client's when the two are split (ADR 0013).
 */
function teamMessage(a: Activity): { subject: string; body: string } | null {
  const notice = noticeFor(a);
  if (!notice) return null;
  return { subject: notice.subject, body: `${notice.body}\n\n${adminBase()}${notice.path}` };
}

subscribe(async (activity) => {
  const to = teamNotifyAddress();
  if (!to) return;
  const message = teamMessage(activity);
  if (!message) return;
  try {
    await sendPlain(to, `awtm forge, ${message.subject}`, message.body);
  } catch (error) {
    await requestLogger.error("team notification failed", { type: activity.type, error: safeError(error) });
  }
});

/**
 * CLAUDE.md 5.1: creating a project sends one email with the link. A failure
 * does not block creation; the admin page shows it and offers a retry.
 */
export async function sendLinkEmail(args: {
  to: string;
  contactName: string;
  businessName: string;
  link: string;
}): Promise<void> {
  const firstName = args.contactName.trim().split(/\s+/)[0] || args.contactName;
  const body = [
    `Hello ${firstName},`,
    "",
    "Thank you for talking to us. Here is your page.",
    "",
    args.link,
    "",
    "Everything we do together will be on it: the questionnaire first, then the agreement you read before anything starts, a written update every week, and your invoices. It is one link, it is yours, and it does not expire. Keep it wherever you keep things.",
    "",
    "The first thing on it is a questionnaire. About ten minutes, mostly about what is going wrong in your own words. Do not tidy your answers up for us, the messy version is the useful one, and I do not know is a real answer to any of it. It saves as you type, so you can start it in a queue somewhere and finish it later.",
    "",
    "The page will ask for a six digit code the first time you open it on a phone or a laptop. That code comes to this address. There is no password to remember, and there never will be one.",
    "",
    "Worth reading twice: we will never ask you for a password, an API key or a one-time code, and neither will anyone who says they are us. There is no box anywhere on your page that wants one.",
    "",
    "Anything at all, message me on WhatsApp. You do not need to wait for a call.",
    "",
    "Rahul",
    "awtm forge",
  ].join("\n");
  await sendPlain(args.to, `Your awtm forge page, ${args.businessName}`, body);
}

/** Import for the side effect of registering subscribers. */
/** The client's own notifications and emails (Q19), a second subscriber. */
subscribe(tellClient);

export function ready(): true {
  return true;
}
