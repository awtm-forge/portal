import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET is not set");
  return s;
}

/** 32 random bytes, base64url. PORTAL-SPEC 5.9. */
export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Hash of a bearer token. Only the hash is ever stored. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Six digits, zero padded. PORTAL-SPEC 5.10. */
export function sixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Keyed hash of a code, bound to the project, so a leaked table does not
 *  give a searchable six-digit space. */
export function hashCode(projectId: string, code: string): string {
  return createHmac("sha256", secret()).update(`${projectId}:${code}`).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}
