import { paperEmail } from "@/lib/email-paper";

/**
 * The welcome, with the client's link (CLAUDE.md 5.1). Pure: the words in one
 * place, as a letter in the brand's paper and as the same letter in plain
 * text, so a test can read both and the log mailer can print the text.
 *
 * Rewritten on 18 Sep at Ayush's ask ("more welcoming"). The first version
 * opened with "Here is your page" and five paragraphs of instructions. This
 * one welcomes first, gives the one thing to do, and keeps the two rules that
 * matter: no password, ever, and nobody who is us will ask for a code.
 */
export type LinkEmailArgs = {
  contactName: string;
  businessName: string;
  link: string;
  /** A wa.me link to the team, when a phone is in Settings. */
  whatsapp: string | null;
};

export function firstNameOf(contactName: string): string {
  return contactName.trim().split(/\s+/)[0] || contactName.trim();
}

export function linkEmailSubject(contactName: string): string {
  return `Welcome, ${firstNameOf(contactName)}: your awtm forge page`;
}

export function linkEmail(a: LinkEmailArgs): { subject: string; text: string; html: string } {
  const first = firstNameOf(a.contactName);
  const heading = `Welcome, ${first}.`;
  const lead = `We are glad to be doing this with you. From here on, everything about ${a.businessName} and awtm forge lives on one page, and it is yours.`;
  const blocks = [
    {
      lead: "First, ten minutes.",
      text: "The questionnaire is the first thing on your page, and it is in your own words. The messy version is the useful one, and I do not know is a real answer. It saves as you type, so start it anywhere and finish it later.",
    },
    {
      lead: "Then the agreement.",
      text: "You read it and say yes before anything starts. After that, a written update every week, and your invoices, all on the same page. It is one link, it does not expire, and there is nothing to install.",
    },
    {
      lead: "Getting in.",
      text: "The first time you open the page on a phone or a laptop it asks for a six digit code, sent to this address. No password, ever.",
    },
  ];
  const note = "We will never ask you for a password, an API key or a code, and neither will anyone who says they are us. There is no box on your page that wants one.";
  const closing = a.whatsapp
    ? { before: "Anything at all,", link: { label: "message me on WhatsApp", href: a.whatsapp }, after: ". You never have to wait for a call." }
    : { before: "Anything at all, message me on WhatsApp.", after: " You never have to wait for a call." };
  const signoff = ["Rahul", "awtm forge"];
  const footer = `You are getting this because ${a.businessName} is working with awtm forge, Bengaluru. Keep the link: it is how you reach your page.`;

  const text = [
    heading,
    "",
    lead,
    "",
    "Open your page:",
    a.link,
    "",
    ...blocks.flatMap((b) => [`${b.lead} ${b.text}`, ""]),
    note,
    "",
    a.whatsapp ? `Anything at all, message me on WhatsApp: ${a.whatsapp}. You never have to wait for a call.` : "Anything at all, message me on WhatsApp. You never have to wait for a call.",
    "",
    ...signoff,
    "",
    footer,
  ].join("\n");

  const html = paperEmail({
    preheader: lead,
    heading,
    lead,
    button: { label: "Open your page", href: a.link },
    copyLine: "Or copy this address into your browser:",
    blocks,
    note,
    closing,
    signoff,
    footer,
  });

  return { subject: linkEmailSubject(a.contactName), text, html };
}
