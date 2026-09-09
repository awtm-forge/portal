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
export async function freshLink(slug: string): Promise<{ token: string; projectId: string; clientId: string }> {
  const rows = await query<{ id: string; clientId: string }>("SELECT id, clientId FROM Project WHERE slug = ?", [slug]);
  const projectId = rows[0]?.id;
  const clientId = rows[0]?.clientId;
  if (!projectId || !clientId) throw new Error(`seed project ${slug} is missing, run npm run db:seed`);
  // The link is the client's (ADR 0015); a project slug is just how the
  // tests name which seed client they mean.
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await query("UPDATE Client SET accessTokenHash = ? WHERE id = ?", [tokenHash, clientId]);
  await query("DELETE FROM ClientSession WHERE clientId = ?", [clientId]);
  return { token, projectId, clientId };
}

/**
 * The app issues the code for real; only its digits are swapped for ones the
 * test knows. Everything else about the row, its purpose, expiry and single
 * use, stays the app's own.
 */
export async function takeoverLatestCode(projectId: string, purpose: "LOGIN" | "AGREEMENT" | "DELIVERY"): Promise<string> {
  // Codes are keyed to the client, and hashed against the client id, for
  // every purpose. The project id is what the specs hold, so resolve it.
  const owner = await query<{ clientId: string }>("SELECT clientId FROM Project WHERE id = ?", [projectId]);
  const clientId = owner[0]?.clientId;
  if (!clientId) throw new Error("no such project");
  const rows = await query<{ id: string }>(
    "SELECT id FROM OneTimeCode WHERE clientId = ? AND purpose = ? AND consumedAt IS NULL ORDER BY createdAt DESC LIMIT 1",
    [clientId, purpose],
  );
  const id = rows[0]?.id;
  if (!id) throw new Error(`no ${purpose} code was issued`);
  const codeHash = createHmac("sha256", process.env.SESSION_SECRET ?? "").update(`${clientId}:${KNOWN_CODE}`).digest("hex");
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

/**
 * Puts the seed project back to the start of the review loop, clearing
 * everything the loop writes.
 *
 * These fixtures use the raw driver, so the append-only guard in src/lib/db.ts
 * does not apply to them. That is deliberate and does not weaken criterion 16,
 * which is about code paths inside the system: tests/append-only.test.ts proves
 * the guard, and nothing in src/ can reach these statements.
 */
export async function backToBuilding(projectId: string): Promise<void> {
  // A review presupposes an agreed agreement, and another spec file may have
  // un-agreed this one. Establish the precondition rather than depend on the
  // order the files happen to run in.
  await query(
    "UPDATE Agreement SET agreedAt = COALESCE(agreedAt, NOW(3)), agreedByName = COALESCE(agreedByName, 'Arjun Sundaram'), agreedMethod = COALESCE(agreedMethod, 'PORTAL'), sentAt = COALESCE(sentAt, NOW(3)) WHERE projectId = ?",
    [projectId],
  );
  await query("DELETE FROM Referral WHERE projectId = ?", [projectId]);
  await query("DELETE FROM Testimonial WHERE projectId = ?", [projectId]);
  await query("DELETE FROM Day30 WHERE projectId = ?", [projectId]);
  await query("DELETE FROM ReviewRound WHERE projectId = ?", [projectId]);
  await query("DELETE FROM Invoice WHERE projectId = ? AND kind = 'BALANCE'", [projectId]);
  await query("DELETE FROM SignoffEvent WHERE projectId = ? AND kind = 'DELIVERY'", [projectId]);
  await query("UPDATE Project SET deliveredAt = NULL, thanksSeenAt = NULL WHERE id = ?", [projectId]);
  await setPhase(projectId, "BUILDING");
}

/** Opens a round directly, for tests that start from the client's side. */
export async function openRoundDirect(projectId: string, url = "https://staging.example/finished"): Promise<void> {
  const rows = await query<{ n: number | null }>("SELECT MAX(roundNumber) AS n FROM ReviewRound WHERE projectId = ?", [projectId]);
  const next = Number(rows[0]?.n ?? 0) + 1;
  await query(
    "INSERT INTO ReviewRound (id, projectId, roundNumber, sentAt, finishedWorkUrl, outcome) VALUES (?, ?, ?, NOW(3), ?, 'OPEN')",
    [`r${Date.now()}${next}`, projectId, next, url],
  );
  await setPhase(projectId, "IN_REVIEW");
}

/**
 * Puts a project in the delivered state with its day-30 row already open,
 * without waiting a month. The unlock is a comparison made on read
 * (criterion 10), so moving the date is the whole of it: there is no job to
 * trigger and nothing to fake.
 */
export async function day30Open(projectId: string, opts: { unlocked?: boolean } = {}): Promise<void> {
  const unlocked = opts.unlocked ?? true;
  await query("UPDATE Project SET deliveredAt = COALESCE(deliveredAt, NOW(3)) WHERE id = ?", [projectId]);
  await setPhase(projectId, "DELIVERED");
  await query("DELETE FROM Day30 WHERE projectId = ?", [projectId]);
  await query(
    `INSERT INTO Day30 (id, projectId, unlocksAt, frictionNotes)
     VALUES (?, ?, DATE_ADD(NOW(3), INTERVAL ? DAY), '')`,
    [`d30${Date.now()}${Math.random().toString(36).slice(2, 6)}`, projectId, unlocked ? -1 : 30],
  );
}
