import { createHash, createHmac, randomBytes } from "node:crypto";
import { createPool, type Pool } from "mariadb";

/**
 * The e2e fixtures talk to the database directly, on the raw driver rather
 * than Prisma, because Playwright's loader is CommonJS and the generated
 * client is ESM. They only need a handful of statements.
 *
 * Nothing here reveals a code through the app: there is no such route, in any
 * environment. The tests plant a code they know instead (see below).
 */
function connection() {
  const u = new URL(process.env.DATABASE_URL ?? "");
  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
    connectionLimit: 3,
  };
}

let pool: Pool | null = null;
function db(): Pool {
  if (!pool) pool = createPool(connection());
  return pool;
}

export async function query<T = Record<string, unknown>>(sql: string, values: unknown[] = []): Promise<T[]> {
  const rows = await db().query({ sql, rowsAsArray: false }, values);
  return Array.isArray(rows) ? (rows as T[]) : [];
}

export async function closeDb(): Promise<void> {
  if (pool) await pool.end();
  pool = null;
}

export const SEED_SLUG = "sundara-living-storefront";
export const INTAKE_SLUG = "kavya-appliances-store";
export const KNOWN_CODE = "424242";

/** Rotates the project's link so the test holds a token it can actually use. */
export async function freshLink(slug: string): Promise<{ token: string; projectId: string }> {
  const rows = await query<{ id: string }>("SELECT id FROM Project WHERE slug = ?", [slug]);
  const projectId = rows[0]?.id;
  if (!projectId) throw new Error(`seed project ${slug} is missing, run npm run db:seed`);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await query("UPDATE Project SET accessTokenHash = ? WHERE id = ?", [tokenHash, projectId]);
  await query("DELETE FROM ClientSession WHERE projectId = ?", [projectId]);
  return { token, projectId };
}

/**
 * The app issues the code for real; only its digits are swapped for ones the
 * test knows. Everything else about the row, its purpose, expiry and single
 * use, stays the app's own.
 */
export async function takeoverLatestCode(projectId: string, purpose: "LOGIN" | "AGREEMENT" | "DELIVERY"): Promise<string> {
  const rows = await query<{ id: string }>(
    "SELECT id FROM OneTimeCode WHERE projectId = ? AND purpose = ? AND consumedAt IS NULL ORDER BY createdAt DESC LIMIT 1",
    [projectId, purpose],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error(`no ${purpose} code was issued`);
  const codeHash = createHmac("sha256", process.env.SESSION_SECRET ?? "").update(`${projectId}:${KNOWN_CODE}`).digest("hex");
  await query("UPDATE OneTimeCode SET codeHash = ? WHERE id = ?", [codeHash, id]);
  return KNOWN_CODE;
}

export async function resetRateLimits(): Promise<void> {
  await query("DELETE FROM RateLimit");
}

export async function agreementSecrets(projectId: string): Promise<{ costPaise: string; rupees: string; notes: string }> {
  const rows = await query<{ internalCostPaise: bigint | number | string; internalNotes: string }>(
    "SELECT internalCostPaise, internalNotes FROM Agreement WHERE projectId = ?",
    [projectId],
  );
  const row = rows[0];
  if (!row) throw new Error("seed agreement missing");
  const paise = BigInt(row.internalCostPaise as never);
  return { costPaise: paise.toString(), rupees: (paise / 100n).toString(), notes: row.internalNotes };
}

/** Puts the seed project back into the phase a test needs. */
export async function setPhase(projectId: string, phase: string): Promise<void> {
  await query("UPDATE Project SET phase = ? WHERE id = ?", [phase, projectId]);
}
