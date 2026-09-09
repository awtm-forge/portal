import { db } from "@/lib/db";

/**
 * Fixed-window counter in the database, because the Hostinger process is
 * stopped when idle and nothing in memory survives. PORTAL-SPEC 5.14.
 * Returns true when the call is allowed.
 */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  // One statement, because a read followed by a write is a race: two requests
  // from the same address arriving together both found no row and both tried
  // to create one, and the loser threw a duplicate key error instead of being
  // rate limited. A double click was a 500. Same trick as the invoice
  // sequence in modules/invoices: let MySQL do the deciding.
  const cutoff = new Date(Date.now() - windowSeconds * 1000);
  await db.$executeRaw`
    INSERT INTO RateLimit (\`key\`, count, windowStart) VALUES (${key}, 1, NOW(3))
    ON DUPLICATE KEY UPDATE
      count = IF(windowStart < ${cutoff}, 1, count + 1),
      windowStart = IF(windowStart < ${cutoff}, NOW(3), windowStart)`;

  const rows = await db.$queryRaw<{ count: number }[]>`
    SELECT count FROM RateLimit WHERE \`key\` = ${key}`;
  const count = rows[0]?.count;
  if (typeof count !== "number") return true;
  return count <= limit;
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 64);
  return headers.get("x-real-ip")?.slice(0, 64) ?? "unknown";
}
