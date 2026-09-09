import { db } from "@/lib/db";

/**
 * Fixed-window counter in the database, because the Hostinger process is
 * stopped when idle and nothing in memory survives. PORTAL-SPEC 5.14.
 * Returns true when the call is allowed.
 */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  // Increment and read as one thing, on one connection.
  //
  // Two earlier versions were wrong in different ways. Reading the row and
  // then writing it raced: two requests from one address both found nothing,
  // both inserted, and the loser threw a duplicate key error out of the
  // limiter, so a double click was a 500. Fixing that with a single upsert
  // stopped the throwing but left the read separate, and under eight
  // simultaneous calls several of them read a count somebody else had already
  // bumped, so the limit came out fuzzy.
  //
  // LAST_INSERT_ID(expr) stores the value and hands it back on this
  // connection, which is the standard MySQL atomic counter. It is per
  // connection, so it has to run inside a transaction or the pool may answer
  // the second query from a different one.
  const cutoff = new Date(Date.now() - windowSeconds * 1000);
  const count = await db.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO RateLimit (\`key\`, count, windowStart)
      VALUES (${key}, LAST_INSERT_ID(1), NOW(3))
      ON DUPLICATE KEY UPDATE
        count = LAST_INSERT_ID(IF(windowStart < ${cutoff}, 1, count + 1)),
        windowStart = IF(windowStart < ${cutoff}, NOW(3), windowStart)`;
    const rows = await tx.$queryRaw<{ n: bigint | number }[]>`SELECT LAST_INSERT_ID() AS n`;
    return Number(rows[0]?.n ?? 1);
  });
  return count <= limit;
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 64);
  return headers.get("x-real-ip")?.slice(0, 64) ?? "unknown";
}
