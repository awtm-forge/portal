import { phoneDigits } from "@/lib/format";

/** PORTAL-SPEC section 7. Every message is a function of the record. */
export function waLink(phone: string, body: string): string {
  return `https://wa.me/${phoneDigits(phone)}?text=${encodeURIComponent(body)}`;
}

export function questionnaireReadyMessage(input: { contactName: string; link: string }): string {
  return [
    `Hi ${input.contactName}, your questionnaire is ready.`,
    input.link,
    "It takes about ten minutes and saves as you type, so you can leave it and come back.",
    "The page will ask for a six digit code the first time. It goes to the sign-off email you gave us.",
  ].join("\n");
}

/** Only a hash of the link is stored, so the nudge points at the link already sent. */
export function questionnaireNudgeMessage(input: { contactName: string; openSections: string[] }): string {
  const what = input.openSections.length ? `Still open: ${input.openSections.join(", ")}.` : "A couple of sections are still open.";
  return [
    `Hi ${input.contactName}, quick one on the questionnaire. ${what}`,
    "It is the same link I sent before. Say the word if you need it again.",
    "If it is easier, say it out loud on a call and we will type it in.",
  ].join("\n");
}

export function agreementReadyMessage(input: { contactName: string; projectName: string }): string {
  return [
    `Hi ${input.contactName}, your agreement for ${input.projectName} is ready to read.`,
    "It is on your project page, the same link as before. One page: what we are building, what it costs, when it lands, and how you will check it.",
    "If anything in it is wrong, say so on the page itself and we will change it. Nothing is invoiced until you agree.",
  ].join("\n");
}

export function weeklyUpdateMessage(input: {
  contactName: string;
  weekNumber: number;
  weekCount: number | null;
  moved: string;
  nextUp: string;
  needFromYou: string;
  needByDate: string;
  risks: string;
}): string {
  const heading = input.weekCount ? `Week ${input.weekNumber} of ${input.weekCount}` : `Week ${input.weekNumber}`;
  const lines = [`Hi ${input.contactName}, ${heading.toLowerCase()}.`, "", `Moved: ${input.moved}`, `Next: ${input.nextUp}`];
  if (input.needFromYou.trim()) {
    lines.push(`Need from you: ${input.needFromYou}${input.needByDate ? `, by ${input.needByDate}` : ""}`);
  }
  lines.push(`Risks: ${input.risks.trim() ? input.risks : "None this week."}`);
  lines.push("", "It is all on your project page too.");
  return lines.join("\n");
}

export function invoiceIssuedMessage(input: {
  contactName: string;
  number: string;
  amount: string;
  kindLabel: string;
}): string {
  return [
    `Hi ${input.contactName}, invoice ${input.number} is on your project page.`,
    `${input.kindLabel}, ${input.amount}. Bank details are on the invoice itself.`,
    "Nothing needs doing on the page, it is there so you always have a copy.",
  ].join("\n");
}

export function readyForReviewMessage(input: {
  contactName: string;
  projectName: string;
  deliverableCount: number;
  link: string;
}): string {
  const things = input.deliverableCount === 1 ? "one thing" : `${input.deliverableCount} things`;
  return [
    `Hi ${input.contactName}, ${input.projectName} is finished and ready for you to check.`,
    input.link,
    `There are ${things} to look at, each with a line on how to check it yourself. Take your time.`,
    "If anything is off, say so on the page and we keep working. Nothing is invoiced until you are happy.",
  ].join("\n");
}

/**
 * PORTAL-SPEC section 7, the last of the templates. One minute, one number.
 * No link in it: only a hash of theirs is stored, so like the questionnaire
 * nudge this points at the link they already have.
 */
export function day30Message(input: {
  contactName: string;
  projectName: string;
  metricName: string | null;
}): string {
  const ask = input.metricName
    ? `One question: ${input.metricName.toLowerCase()}, where is it now?`
    : "One question: what changed?";
  return [
    `Hi ${input.contactName}, it is a month since we delivered ${input.projectName}.`,
    `Your project page has a day 30 box on it now. ${ask}`,
    "There is a line you wrote on the day, waiting for you to change or leave as it is. Same link as before.",
    "Under a minute, and then we leave you alone.",
  ].join("\n");
}
