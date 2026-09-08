import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { hashCode, hashToken, randomToken, safeEqualHex, sixDigitCode } from "@/lib/crypto";
import { sendCode } from "@/lib/mail";
import { allow, clientIp } from "@/lib/rate-limit";
import { CodePurpose } from "@/generated/prisma/enums";

export const SESSION_DAYS = 30;
const CODE_MINUTES = 10;
const CODE_ATTEMPTS = 5;

export function sessionCookieName(projectId: string): string {
  return `awtm_c_${projectId}`;
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    // Keyed to the configured origin, not NODE_ENV: a production build served
    // over plain HTTP would otherwise set a Secure cookie the browser drops,
    // and no test could ever see it.
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    sameSite: "lax" as const,
    // "/" rather than "/p", because the printable agreement lives at
    // /agreement/[token]/print and a client must be able to open it.
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** PORTAL-SPEC 5.9: look up by hash, then compare the hash in constant time. */
export async function projectByToken(token: string) {
  if (!token || token.length > 64 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const tokenHash = hashToken(token);
  const project = await db.project.findUnique({
    where: { accessTokenHash: tokenHash },
    include: { client: true, intake: { select: { id: true, submittedAt: true, lastSavedAt: true, document: true, answers: true, sectionsDone: true } } },
  });
  if (!project) return null;
  if (!safeEqualHex(project.accessTokenHash, tokenHash)) return null;
  return project;
}

export type ProjectByToken = NonNullable<Awaited<ReturnType<typeof projectByToken>>>;

/** The session this device holds for this project, or null. Touches lastSeenAt. */
export async function currentClientSession(projectId: string) {
  const jar = await cookies();
  const raw = jar.get(sessionCookieName(projectId))?.value;
  if (!raw) return null;
  const session = await db.clientSession.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!session || session.projectId !== projectId || session.expiresAt < new Date()) return null;
  if (Date.now() - session.lastSeenAt.getTime() > 60 * 60 * 1000) {
    await db.clientSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  return session;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "the address on file";
  const shown = user.length <= 2 ? user[0] ?? "" : user.slice(0, 2);
  return `${shown}${"*".repeat(Math.max(2, user.length - shown.length))}@${domain}`;
}

export type RequestCodeResult = { ok: true; sentTo: string } | { ok: false; reason: "rate_limited" | "send_failed" };

/** PORTAL-SPEC 5.10 and 5.14. */
export async function requestCode(
  project: ProjectByToken,
  purpose: CodePurpose,
  headers: Headers,
): Promise<RequestCodeResult> {
  const ip = clientIp(headers);
  const okProject = await allow(`code-req:p:${project.id}`, 8, 10 * 60);
  const okIp = await allow(`code-req:ip:${ip}`, 20, 60 * 60);
  if (!okProject || !okIp) return { ok: false, reason: "rate_limited" };

  const code = sixDigitCode();
  const to = project.signoffPersonEmail;
  await db.$transaction([
    db.oneTimeCode.updateMany({
      where: { projectId: project.id, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    db.oneTimeCode.create({
      data: {
        projectId: project.id,
        purpose,
        codeHash: hashCode(project.id, code),
        sentTo: to,
        expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
      },
    }),
  ]);
  try {
    await sendCode(to, code, project.client.businessName, purpose);
  } catch {
    return { ok: false, reason: "send_failed" };
  }
  return { ok: true, sentTo: maskEmail(to) };
}

export type VerifyCodeResult =
  | { ok: true }
  | { ok: false; reason: "rate_limited" | "no_code" | "expired" | "locked" | "wrong"; attemptsLeft?: number };

export async function verifyCode(
  project: ProjectByToken,
  purpose: CodePurpose,
  input: string,
  headers: Headers,
): Promise<VerifyCodeResult> {
  const ip = clientIp(headers);
  const okProject = await allow(`code-ver:p:${project.id}`, 20, 10 * 60);
  const okIp = await allow(`code-ver:ip:${ip}`, 40, 60 * 60);
  if (!okProject || !okIp) return { ok: false, reason: "rate_limited" };

  const code = input.replace(/\D/g, "");
  const row = await db.oneTimeCode.findFirst({
    where: { projectId: project.id, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false, reason: "no_code" };
  if (row.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (row.attempts >= CODE_ATTEMPTS) return { ok: false, reason: "locked" };

  const matches = code.length === 6 && safeEqualHex(row.codeHash, hashCode(project.id, code));
  if (!matches) {
    const updated = await db.oneTimeCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    const left = CODE_ATTEMPTS - updated.attempts;
    return left <= 0 ? { ok: false, reason: "locked" } : { ok: false, reason: "wrong", attemptsLeft: left };
  }

  const consumed = await db.oneTimeCode.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) return { ok: false, reason: "expired" };

  if (purpose !== CodePurpose.LOGIN) return { ok: true };

  const sessionToken = randomToken();
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  await db.clientSession.create({
    data: {
      projectId: project.id,
      tokenHash: hashToken(sessionToken),
      expiresAt: new Date(Date.now() + maxAge * 1000),
      userAgent: headers.get("user-agent")?.slice(0, 400) ?? null,
    },
  });
  const jar = await cookies();
  jar.set(sessionCookieName(project.id), sessionToken, cookieOptions(maxAge));
  return { ok: true };
}

/** Rotating the link ends every session too. */
export async function rotateProjectToken(projectId: string): Promise<string> {
  const token = randomToken();
  await db.$transaction([
    db.project.update({
      where: { id: projectId },
      data: { accessTokenHash: hashToken(token), tokenRotatedAt: new Date() },
    }),
    db.clientSession.deleteMany({ where: { projectId } }),
    db.oneTimeCode.updateMany({ where: { projectId, consumedAt: null }, data: { consumedAt: new Date() } }),
  ]);
  return token;
}

export function projectLink(token: string): string {
  const base = (process.env.APP_URL ?? "https://awtmforge.com").replace(/\/$/, "");
  return `${base}/p/${token}`;
}
