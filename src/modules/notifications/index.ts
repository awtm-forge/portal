/**
 * Everything that tells a person something (ADR 0006). Subscribers listen to
 * activity events; nothing in the module that made a change calls an email
 * function directly. A new side effect is a new case here.
 *
 * Payloads reach here already serialized, so no template can carry internal
 * cost even by accident (PORTAL-SPEC 5.13).
 */
import { adminBase } from "@/lib/hosts";
import { logger } from "@/lib/logger";
import { sendPlain, teamNotifyAddress } from "@/lib/mail";
import { subscribe, type Activity } from "@/modules/events";

/** Team links go to the team host, which is a different name from the
 *  client's when the two are split (ADR 0013). */
function adminLink(projectId: string | null): string {
  const base = adminBase();
  return projectId ? `${base}/admin/projects/${projectId}` : `${base}/admin`;
}

/** One line each, plain text. CLAUDE.md section 5: name the project and the event. */
function teamMessage(a: Activity): { subject: string; body: string } | null {
  const p = a.payload;
  const name = typeof p.projectName === "string" ? p.projectName : "A project";
  const business = typeof p.businessName === "string" ? ` (${p.businessName})` : "";
  const where = `\n\n${adminLink(a.projectId)}`;

  switch (a.type) {
    case "intake.submitted":
      return { subject: `${name}: questionnaire sent`, body: `${name}${business} finished the questionnaire.${where}` };
    case "agreement.note":
      return {
        subject: `${name}: something is off with the agreement`,
        body: `${name}${business} pushed back on version ${p.version}. The agreement is back in draft.${where}`,
      };
    case "agreement.agreed":
      return {
        subject: `${name}: agreed`,
        body: `${name}${business} agreed version ${p.version}, ${p.method === "WHATSAPP" ? "recorded from WhatsApp" : "in the portal"}. Total ${p.total}. The advance invoice is raised.${where}`,
      };
    case "invoice.issued":
      return { subject: `${name}: invoice ${p.number}`, body: `${p.kindLabel ?? p.kind} invoice ${p.number} for ${p.amount}.${where}` };
    case "review.changes_requested":
      return { subject: `${name}: changes requested`, body: `${name}${business} says something is off. Back to building.${where}` };
    case "delivery.signed_off":
      return { subject: `${name}: delivered`, body: `${name}${business} signed off the delivery. The balance invoice is raised.${where}` };
    case "thanks.sent":
      return { subject: `${name}: thank-you page`, body: `${name}${business} sent the thank-you page.${where}` };
    case "day30.approved":
      return { subject: `${name}: day 30 done`, body: `${name}${business} gave the number and approved the quote.${where}` };
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
      };
    default:
      return null;
  }
}

subscribe(async (activity) => {
  const to = teamNotifyAddress();
  if (!to) return;
  const message = teamMessage(activity);
  if (!message) return;
  try {
    await sendPlain(to, `awtm forge, ${message.subject}`, message.body);
  } catch (error) {
    logger.error("team notification failed", { type: activity.type, error: String(error) });
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
  projectName: string;
  link: string;
}): Promise<void> {
  const firstName = args.contactName.trim().split(/\s+/)[0] || args.contactName;
  const body = [
    `Hello ${firstName},`,
    "",
    `Thank you for trusting us with ${args.projectName}. Here is your page.`,
    "",
    args.link,
    "",
    "Everything to do with your project will be on it: the questionnaire first, then the agreement you read before anything starts, a written update every week, and your invoices. It is one link, it is yours, and it does not expire. Keep it wherever you keep things.",
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
  await sendPlain(args.to, `Your project page, ${args.businessName}`, body);
}

/** Import for the side effect of registering subscribers. */
export function ready(): true {
  return true;
}
