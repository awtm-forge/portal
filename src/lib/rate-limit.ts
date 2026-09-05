import { db } from "@/lib/db";

/**
 * Fixed-window counter in the database, because the Hostinger process is
 * stopped when idle and nothing in memory survives. PORTAL-SPEC 5.14.
 * Returns true when the call is allowed.
 */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const now = new Date();
  const windowStartCutoff = new Date(now.getTime() - windowSeconds * 1000);
  const row = await db.rateLimit.findUnique({ where: { key } });
  if (!row || row.windowStart < windowStartCutoff) {
    await db.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    });
    return true;
  }
  if (row.count >= limit) return false;
  await db.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  return true;
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 64);
  return headers.get("x-real-ip")?.slice(0, 64) ?? "unknown";
}
