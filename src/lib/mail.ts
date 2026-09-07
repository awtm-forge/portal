import nodemailer from "nodemailer";

/**
 * Which transport to use. "log" writes the message to the server log instead
 * of sending it, which is what development and the end to end tests run on.
 * Production sets SMTP_HOST and never sets MAIL_TRANSPORT, and a production
 * process with neither refuses to send rather than silently dropping mail.
 */
function transportMode(): "smtp" | "log" {
  if (process.env.MAIL_TRANSPORT === "log") return "log";
  if (process.env.SMTP_HOST) return "smtp";
  if (process.env.NODE_ENV === "production") {
    throw new Error("No mail transport: set SMTP_HOST, or MAIL_TRANSPORT=log for a test run");
  }
  return "log";
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
  LOGIN: "It opens the {business} project page.",
  AGREEMENT: "It confirms that you are agreeing to the {business} agreement.",
  DELIVERY: "It confirms that you are signing off the {business} delivery.",
};

/** Used only for the one-time code. PORTAL-SPEC section 3. */
export async function sendCode(to: string, code: string, businessName: string, purpose = "LOGIN"): Promise<void> {
  const what = (PURPOSE_LINE[purpose] ?? PURPOSE_LINE.LOGIN).replace("{business}", businessName);
  const text = [
    `Your awtm forge code is ${code}`,
    "",
    `${what} It is good for ten minutes and works once.`,
    "If you did not ask for it, ignore this email. Nobody from awtm forge will ever ask you for this code, a password or an OTP.",
    "",
    "awtm forge",
  ].join("\n");

  if (transportMode() === "log") {
    console.log(`[mail:log] to ${to}: code ${code}`);
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
    console.log(`[mail:log] to ${to}: ${subject}`);
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
