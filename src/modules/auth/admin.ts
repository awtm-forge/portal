import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken, randomToken } from "@/lib/crypto";
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
  // Always run a compare so timing does not reveal whether the email exists.
  const hash = user?.passwordHash ?? "$2a$12$CwTycUXWue0Thq9StjUM0uJ8Z0a2N2mA1Qm0F0kY7m3s6Y2mJ0Q0e";
  const good = await bcrypt.compare(password, hash);
  if (!user || !good) return { ok: false, reason: "bad_credentials" };

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
