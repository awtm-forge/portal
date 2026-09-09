import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { clientBase } from "@/lib/hosts";
import { hashCode, hashToken, randomToken, safeEqualHex, sixDigitCode } from "@/lib/crypto";
import { sendCode } from "@/lib/mail";
import { allow, clientIp } from "@/lib/rate-limit";
import { CodePurpose } from "@/generated/prisma/enums";

/**
 * How a client gets in (PORTAL-SPEC 5.9, 5.10, 5.14).
 *
 * The link, the session and the login code belong to the client, not to a
 * project (ADR 0015): a client can be signed in and filling the questionnaire
 * before any project exists, and every project they ever have appears on the
 * same link. The two sign-off codes are the exception. A sign-off is on a
 * piece of work, so those carry the project as well and go to its sign-off
 * person; the login code goes to the client's contact.
 */
export const SESSION_DAYS = 30;
const CODE_MINUTES = 10;
const CODE_ATTEMPTS = 5;

export function sessionCookieName(clientId: string): string {
  return `awtm_c_${clientId}`;
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    // Keyed to the configured origin, not NODE_ENV: a production build served
    // over plain HTTP would otherwise set a Secure cookie the browser drops,
    // and no test could ever see it.
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    sameSite: "lax" as const,
    // "/" rather than "/p", because the printable routes live outside it and
    // a client must be able to open their own.
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** PORTAL-SPEC 5.9: look up by hash, then compare the hash in constant time. */
export async function clientByToken(token: string) {
  if (!token || token.length > 64 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const tokenHash = hashToken(token);
  const client = await db.client.findUnique({
    where: { accessTokenHash: tokenHash },
    include: {
      intake: { select: { id: true, submittedAt: true, lastSavedAt: true, document: true, answers: true, sectionsDone: true } },
    },
  });
  if (!client) return null;
  if (!safeEqualHex(client.accessTokenHash, tokenHash)) return null;
  return client;
}

export type ClientByToken = NonNullable<Awaited<ReturnType<typeof clientByToken>>>;

/** The session this device holds for this client, or null. Touches lastSeenAt. */
export async function currentClientSession(clientId: string) {
  const jar = await cookies();
  const raw = jar.get(sessionCookieName(clientId))?.value;
  if (!raw) return null;
  const session = await db.clientSession.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!session || session.clientId !== clientId || session.expiresAt < new Date()) return null;
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

/**
 * Who a code goes to. A login code reaches the person we talk to; a sign-off
 * code reaches the person who says yes for that project, who may differ.
 */
export type CodeScope = { client: ClientByToken; project?: { id: string; signoffPersonEmail: string } | null };

function recipient(scope: CodeScope, purpose: CodePurpose): string {
  if (purpose !== CodePurpose.LOGIN && scope.project) return scope.project.signoffPersonEmail;
  return scope.client.contactEmail;
}

export type RequestCodeResult = { ok: true; sentTo: string } | { ok: false; reason: "rate_limited" | "send_failed" };

/** PORTAL-SPEC 5.10 and 5.14. */
export async function requestCode(scope: CodeScope, purpose: CodePurpose, headers: Headers): Promise<RequestCodeResult> {
  const ip = clientIp(headers);
  const okClient = await allow(`code-req:c:${scope.client.id}`, 8, 10 * 60);
  const okIp = await allow(`code-req:ip:${ip}`, 20, 60 * 60);
  if (!okClient || !okIp) return { ok: false, reason: "rate_limited" };

  const code = sixDigitCode();
  const to = recipient(scope, purpose);
  const projectId = purpose === CodePurpose.LOGIN ? null : (scope.project?.id ?? null);
  await db.$transaction([
    db.oneTimeCode.updateMany({
      where: { clientId: scope.client.id, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    db.oneTimeCode.create({
      data: {
        clientId: scope.client.id,
        projectId,
        purpose,
        codeHash: hashCode(scope.client.id, code),
        sentTo: to,
        expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
      },
    }),
  ]);
  try {
    await sendCode(to, code, scope.client.businessName, purpose);
  } catch {
    return { ok: false, reason: "send_failed" };
  }
  return { ok: true, sentTo: maskEmail(to) };
}

export type VerifyCodeResult =
  | { ok: true }
  | { ok: false; reason: "rate_limited" | "no_code" | "expired" | "locked" | "wrong"; attemptsLeft?: number };

export async function verifyCode(scope: CodeScope, purpose: CodePurpose, input: string, headers: Headers): Promise<VerifyCodeResult> {
  const ip = clientIp(headers);
  const okClient = await allow(`code-ver:c:${scope.client.id}`, 20, 10 * 60);
  const okIp = await allow(`code-ver:ip:${ip}`, 40, 60 * 60);
  if (!okClient || !okIp) return { ok: false, reason: "rate_limited" };

  const code = input.replace(/\D/g, "");
  const row = await db.oneTimeCode.findFirst({
    where: { clientId: scope.client.id, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false, reason: "no_code" };
  if (row.expiresAt < new Date()) return { ok: false, reason: "expired" };
  if (row.attempts >= CODE_ATTEMPTS) return { ok: false, reason: "locked" };

  const matches = code.length === 6 && safeEqualHex(row.codeHash, hashCode(scope.client.id, code));
  if (!matches) {
    const updated = await db.oneTimeCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    const left = CODE_ATTEMPTS - updated.attempts;
    return left <= 0 ? { ok: false, reason: "locked" } : { ok: false, reason: "wrong", attemptsLeft: left };
  }

  const consumed = await db.oneTimeCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (consumed.count !== 1) return { ok: false, reason: "expired" };

  if (purpose !== CodePurpose.LOGIN) return { ok: true };

  const sessionToken = randomToken();
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  await db.clientSession.create({
    data: {
      clientId: scope.client.id,
      tokenHash: hashToken(sessionToken),
      expiresAt: new Date(Date.now() + maxAge * 1000),
      userAgent: headers.get("user-agent")?.slice(0, 400) ?? null,
    },
  });
  const jar = await cookies();
  jar.set(sessionCookieName(scope.client.id), sessionToken, cookieOptions(maxAge));
  return { ok: true };
}

/** A fresh link. Only its hash is stored, so the caller holds the only copy. */
export function mintToken(): { token: string; tokenHash: string } {
  const token = randomToken();
  return { token, tokenHash: hashToken(token) };
}

/** Rotating the link ends every session and every open code too. */
export async function rotateClientToken(clientId: string): Promise<string> {
  const { token, tokenHash } = mintToken();
  await db.$transaction([
    db.client.update({ where: { id: clientId }, data: { accessTokenHash: tokenHash, tokenRotatedAt: new Date() } }),
    db.clientSession.deleteMany({ where: { clientId } }),
    db.oneTimeCode.updateMany({ where: { clientId, consumedAt: null }, data: { consumedAt: new Date() } }),
  ]);
  return token;
}

export function clientLink(token: string): string {
  return `${clientBase()}/p/${token}`;
}
