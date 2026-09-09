import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken, randomToken, safeEqualHex } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { allow, clientIp } from "@/lib/rate-limit";

const COOKIE = "awtm_admin";
const SESSION_DAYS = 14;

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    // Keyed to the configured origin, not NODE_ENV: a production build served
    // over plain HTTP would otherwise set a Secure cookie the browser drops,
    // and no test could ever see it.
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export type AdminLoginResult = { ok: true } | { ok: false; reason: "rate_limited" | "bad_credentials" };

export async function adminLogin(email: string, password: string, headers: Headers): Promise<AdminLoginResult> {
  const ip = clientIp(headers);
  if (!(await allow(`admin-login:ip:${ip}`, 10, 15 * 60))) return { ok: false, reason: "rate_limited" };
  const user = await db.adminUser.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Always run a compare so timing does not reveal whether the email exists,
  // nor whether an account is still waiting on its setup link.
  const hash = user?.passwordHash ?? "$2a$12$CwTycUXWue0Thq9StjUM0uJ8Z0a2N2mA1Qm0F0kY7m3s6Y2mJ0Q0e";
  const good = await bcrypt.compare(password, hash);
  if (!user || !user.passwordHash || !good) return { ok: false, reason: "bad_credentials" };

  const token = randomToken();
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  await db.adminSession.create({
    data: { adminUserId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + maxAge * 1000) },
  });
  (await cookies()).set(COOKIE, token, cookieOptions(maxAge));
  return { ok: true };
}

export async function currentAdmin() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const session = await db.adminSession.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { adminUser: { select: { id: true, email: true, name: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  if (Date.now() - session.lastSeenAt.getTime() > 60 * 60 * 1000) {
    await db.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  return session.adminUser;
}

export type AdminUserView = NonNullable<Awaited<ReturnType<typeof currentAdmin>>>;

export async function requireAdmin(): Promise<AdminUserView> {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export async function adminLogout(): Promise<void> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (raw) await db.adminSession.deleteMany({ where: { tokenHash: hashToken(raw) } });
  jar.delete(COOKIE);
}

/* -------------------------------------------------------------------------
 * First run (ADR 0014).
 *
 * Some hosts give you no way to run a script beside the app. Hostinger's
 * Node deploy is one: it ships a pruned build with no dev dependencies and no
 * `scripts/` directory, so `npm run admin:create` cannot run there at all,
 * over SSH or from the panel. Without this, a fresh deploy is a working
 * application that nobody can ever sign in to.
 * ---------------------------------------------------------------------- */

/**
 * How many people can actually sign in.
 *
 * Not how many rows exist. An account created by `admin:create` has no
 * password until somebody opens its setup link, and if that link is lost the
 * row is a locked door with no key: it blocks first run without letting
 * anyone in. That happened on the live site on 9 September, and the fix is to
 * count what matters, which is whether the system is reachable by anyone.
 */
export function activatedAdminCount(): Promise<number> {
  return db.adminUser.count({ where: { NOT: { passwordHash: null } } });
}

export type FirstRunResult =
  | { ok: true; token: string }
  | { ok: false; reason: "not_first_run" | "no_key_configured" | "bad_key" | "rate_limited" | "invalid" };

const SETUP_HOURS = 48;

/**
 * Makes the first admin account, and only ever the first.
 *
 * Three things have to be true, and each closes a different hole: no admin
 * may exist yet, so this cannot be used to add an account later or to take
 * over a live system; `SETUP_KEY` must be set, so the window between a deploy
 * finishing and someone claiming it is not open to whoever finds the URL
 * first; and the key must match, compared on its hash in constant time so the
 * answer cannot be felt out a character at a time.
 *
 * It sets no password. It issues the same one-time setup link the script
 * issues, and the person chooses their own secret on the existing screen, so
 * there is still exactly one place a password is ever set.
 */
export async function createFirstAdmin(args: {
  email: string;
  name: string;
  key: string;
  headers: Headers;
}): Promise<FirstRunResult> {
  const ip = clientIp(args.headers);
  if (!(await allow(`first-run:ip:${ip}`, 5, 60 * 60))) return { ok: false, reason: "rate_limited" };

  const expected = process.env.SETUP_KEY?.trim();
  if (!expected) return { ok: false, reason: "no_key_configured" };
  if (!safeEqualHex(hashToken(expected), hashToken(args.key))) return { ok: false, reason: "bad_key" };

  const email = args.email.trim().toLowerCase();
  const name = args.name.trim();
  if (!email.includes("@") || email.length > 200 || !name || name.length > 120) {
    return { ok: false, reason: "invalid" };
  }

  // Checked after the key, so a wrong key never learns whether the system is
  // claimed.
  if ((await activatedAdminCount()) > 0) return { ok: false, reason: "not_first_run" };

  const token = randomToken();
  try {
    // Upsert, not create. A row with no password is an account nobody can use,
    // usually one whose setup link was lost, and reissuing its link is exactly
    // what is wanted. The unique index on email is what settles two requests
    // arriving together.
    await db.adminUser.upsert({
      where: { email },
      create: {
        email,
        name,
        setupTokenHash: hashToken(token),
        setupExpiresAt: new Date(Date.now() + SETUP_HOURS * 60 * 60 * 1000),
      },
      update: {
        name,
        setupTokenHash: hashToken(token),
        setupExpiresAt: new Date(Date.now() + SETUP_HOURS * 60 * 60 * 1000),
        setupLinkUsedAt: null,
      },
    });
  } catch {
    return { ok: false, reason: "not_first_run" };
  }
  logger.info("first admin created", { email });
  return { ok: true, token };
}

/* -------------------------------------------------------------------------
 * The second account, made by the first. PORTAL-SPEC 6.6 allows two admins
 * and no self-registration. On a host that will not run a script this is the
 * only way the second person ever gets in, and it is also the password reset
 * for either of them: running it for an existing address reissues the link.
 * ---------------------------------------------------------------------- */

export type InviteResult =
  | { ok: true; token: string; email: string }
  | { ok: false; reason: "invalid" | "limit" };

export async function listAdmins() {
  return db.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, passwordHash: true, setupExpiresAt: true },
  });
}

export async function inviteAdmin(args: { email: string; name: string }): Promise<InviteResult> {
  const email = args.email.trim().toLowerCase();
  const name = args.name.trim();
  if (!email.includes("@") || email.length > 200 || !name || name.length > 120) {
    return { ok: false, reason: "invalid" };
  }
  const others = await db.adminUser.count({ where: { NOT: { email } } });
  if (others >= 2) return { ok: false, reason: "limit" };

  const token = randomToken();
  await db.adminUser.upsert({
    where: { email },
    create: {
      email,
      name,
      setupTokenHash: hashToken(token),
      setupExpiresAt: new Date(Date.now() + SETUP_HOURS * 60 * 60 * 1000),
    },
    update: {
      name,
      setupTokenHash: hashToken(token),
      setupExpiresAt: new Date(Date.now() + SETUP_HOURS * 60 * 60 * 1000),
      setupLinkUsedAt: null,
    },
  });
  logger.info("admin invited", { email });
  return { ok: true, token, email };
}
