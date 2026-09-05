import nodemailer from "nodemailer";

/** Used only for the one-time code. PORTAL-SPEC section 3. */
export async function sendCode(to: string, code: string, businessName: string): Promise<void> {
  const host = process.env.SMTP_HOST;
  const text = [
    `Your awtm forge code is ${code}`,
    "",
    `It opens the ${businessName} project page. It is good for ten minutes and works once.`,
    "If you did not ask for it, ignore this email. Nobody from awtm forge will ever ask you for this code, a password or an OTP.",
    "",
    "awtm forge",
  ].join("\n");

  if (!host) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP_HOST is not set");
    // Development only. Never in production: a code must not reach a log.
    console.log(`[dev mail] to ${to}: code ${code}`);
    return;
  }

  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: Number(process.env.SMTP_PORT ?? 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject: `${code} is your awtm forge code`,
    text,
  });
}
