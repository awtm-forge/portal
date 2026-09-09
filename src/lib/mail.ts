import nodemailer from "nodemailer";

/**
 * Which transport to use. "log" writes the message to the server log instead
 * of sending it, which is what development and the end to end tests run on.
 * Production sets SMTP_HOST and never sets MAIL_TRANSPORT, and a production
 * process with neither refuses to send rather than silently dropping mail.
 */
function transportMode(): "smtp" | "log" {
  const mode = mailMode();
  if (mode === "none") {
    throw new Error("No mail transport: set SMTP_HOST, or MAIL_TRANSPORT=log for a test run");
  }
  return mode;
}

/**
 * What sending would do, for /healthz. "none" is the production state where
 * nothing is configured and every code silently fails from the client's side
 * with "the email did not go out", which looks like a bug and is a missing
 * variable. Naming it here is what turns an afternoon into a glance.
 */
export function mailMode(): "smtp" | "log" | "none" {
  if (process.env.MAIL_TRANSPORT === "log") return "log";
  if (process.env.SMTP_HOST) return "smtp";
  if (process.env.NODE_ENV === "production") return "none";
  return "log";
}

/**
 * Development and the test runs. The whole message goes to the log, body and
 * all, because the wording is the thing worth checking and there is no inbox
 * to check it in. Never reached in production: transportMode throws first.
 */
function logMail(to: string, subject: string, text: string): void {
  const rule = "-".repeat(64);
  console.log(`\n[mail:log] to ${to}\nSubject: ${subject}\n${rule}\n${text}\n${rule}\n`);
}

function smtpTransport() {
  const port = Number(process.env.SMTP_PORT ?? 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const PURPOSE_LINE: Record<string, string> = {
  LOGIN: "It opens your {business} page.",
  AGREEMENT: "It goes with your yes to the {business} agreement, so the record shows it was you.",
  DELIVERY: "It goes with your sign-off on the {business} delivery, so the record shows it was you.",
};

/** Used only for the one-time code. PORTAL-SPEC section 3. */
export async function sendCode(to: string, code: string, businessName: string, purpose = "LOGIN"): Promise<void> {
  const what = (PURPOSE_LINE[purpose] ?? PURPOSE_LINE.LOGIN).replace("{business}", businessName);
  const text = [
    `${code}`,
    "",
    `That is your code. ${what} It lasts ten minutes and works once.`,
    "",
    "If you did not ask for it, nothing has happened and you can ignore this.",
    "",
    "One rule worth knowing: we will never ask you to send this code on to anyone, and we will never ask you for a password. Neither will anyone who says they are us.",
    "",
    "Rahul",
    "awtm forge",
  ].join("\n");

  if (transportMode() === "log") {
    logMail(to, `${code} is your awtm forge code`, text);
    return;
  }

  await smtpTransport().sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject: `${code} is your awtm forge code`,
    text,
  });
}

/** A plain message from the record. Never carries internal cost: ADR 0009. */
export async function sendPlain(to: string, subject: string, text: string): Promise<void> {
  if (transportMode() === "log") {
    logMail(to, subject, text);
    return;
  }
  await smtpTransport().sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject,
    text,
  });
}

export function teamNotifyAddress(): string | null {
  const to = process.env.TEAM_NOTIFY_EMAIL?.trim();
  return to ? to : null;
}
