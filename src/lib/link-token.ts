/**
 * The token inside a client link somebody pasted (15 Sep).
 *
 * The team keeps client links in sent mail and in WhatsApp threads, so what
 * arrives is a whole address, sometimes with a query string or a stray space,
 * and sometimes just the token on its own. Whatever the host, the token is the
 * last path segment after /p/. Null for anything that does not look like one;
 * the caller still checks it against the stored hash before believing it.
 */
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

export function tokenFromPastedLink(pasted: string): string | null {
  const text = pasted.trim();
  if (!text) return null;
  const at = text.lastIndexOf("/p/");
  const raw = at === -1 ? text : text.slice(at + 3);
  const token = raw.split(/[?#\s/]/, 1)[0] ?? "";
  return TOKEN.test(token) ? token : null;
}
