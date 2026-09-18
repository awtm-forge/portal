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
import { phoneDigits } from "@/lib/format";
import { sendPlain, teamNotifyAddress } from "@/lib/mail";
import { sendTeamWhatsapp, whatsappMode } from "@/lib/whatsapp-cloud";
import { subscribe, type Activity } from "@/modules/events";
import { tellClient } from "@/modules/notifications/client";
import { linkEmail } from "@/modules/notifications/link-email";
import { noticeFor } from "@/modules/notifications/team";
import { company } from "@/modules/settings";

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
 * The same notice on WhatsApp, to the team's own number, when the Cloud API
 * values are set (ADR 0026). The sentence is the bell's and the email's; only
 * the shape changes, to the three parameters the approved template takes. A
 * failure is logged with the status and Meta's code, never the request.
 */
subscribe(async (activity) => {
  if (whatsappMode() !== "cloud") return;
  const notice = noticeFor(activity);
  if (!notice) return;
  const result = await sendTeamWhatsapp({
    what: notice.subject,
    line: notice.body.split("\n")[0] ?? "",
    link: `${adminBase()}${notice.path}`,
  });
  if (!result.ok) await requestLogger.error("team WhatsApp failed", { type: activity.type, reason: result.reason });
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
  // The words live in link-email.ts, as a letter in the brand's paper and as
  // the same letter in plain text (Ayush, 18 Sep: "more welcoming"). The
  // WhatsApp line carries a link when a phone is in Settings.
  const phone = (await company()).phone.trim();
  const whatsapp = phone ? `https://wa.me/${phoneDigits(phone)}` : null;
  const mail = linkEmail({ contactName: args.contactName, businessName: args.businessName, link: args.link, whatsapp });
  await sendPlain(args.to, mail.subject, mail.text, mail.html);
}

/** Import for the side effect of registering subscribers. */
/** The client's own notifications and emails (Q19), a second subscriber. */
subscribe(tellClient);

export function ready(): true {
  return true;
}
