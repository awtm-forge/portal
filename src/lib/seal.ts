import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Reversible encryption for the one thing the team has to be able to read back:
 * a client's own access link (14 Sep).
 *
 * Everything else in this system that is secret is hashed, and stays hashed.
 * A link is different because it is not a password, it is an address we gave
 * someone, and Rahul has to be able to send it again without breaking the one
 * they already have. Rotating to re-send is what we had, and it takes the
 * client's bookmarked link away to solve our problem.
 *
 * The key is derived from SESSION_SECRET, which lives in the environment and
 * never in the database, so a database dump on its own reveals nothing. That
 * is the whole of the protection this offers, and it is worth being plain
 * about: anyone holding both the dump and the environment holds the links.
 *
 * AES-256-GCM, a fresh random nonce per value, and the tag checked on the way
 * back, so a tampered value fails rather than decrypting to rubbish.
 */
const NONCE = 12;
const TAG = 16;

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET is not set");
  // A fixed salt is fine here: the secret is already high entropy and this is
  // key separation from the other uses of it, not password stretching.
  return scryptSync(secret, "awtm-seal-v1", 32);
}

export function seal(plain: string): string {
  const nonce = randomBytes(NONCE);
  const cipher = createCipheriv("aes-256-gcm", key(), nonce);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), body]).toString("base64url");
}

/** Null for anything that was not sealed by this key, rather than a throw. */
export function unseal(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  try {
    const raw = Buffer.from(sealed, "base64url");
    if (raw.length <= NONCE + TAG) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, NONCE));
    decipher.setAuthTag(raw.subarray(NONCE, NONCE + TAG));
    return Buffer.concat([decipher.update(raw.subarray(NONCE + TAG)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
