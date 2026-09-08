/**
 * Two hostnames, one app. Rahul's decision on 9 Sep 2026, ADR 0013:
 * the client portal answers on one hostname and the team admin on another,
 * from one codebase and one node process.
 *
 * When `ADMIN_URL` is unset, or the two resolve to the same hostname, the app
 * runs on a single host and refuses nothing. That is what development and the
 * end to end tests run on, and it stays a valid way to deploy: the separation
 * that keeps client data from the team's views is the serializers and the
 * session cookies, not DNS.
 */
const FALLBACK = "https://portal.awtmforge.com";

/**
 * A value that is not an absolute http or https URL is treated as unset,
 * loudly. Without this a `ADMIN_URL=dashboard.awtmforge.com` in the Hostinger
 * panel, with the scheme forgotten, would put "dashboard.awtmforge.com/admin"
 * into every team email: a string that is not a link, in the one place nobody
 * reads carefully.
 */
function normalise(value: string | undefined, fallback: string, name: string): string {
  const raw = (value ?? "").trim();
  if (!raw) return fallback.replace(/\/$/, "");
  if (!hostnameOf(raw)) {
    console.warn(`[hosts] ${name} is not an absolute http or https URL, ignoring it: ${raw}`);
    return fallback.replace(/\/$/, "");
  }
  return raw.replace(/\/$/, "");
}

/** Where a client's link points. `APP_URL`. */
export function clientBase(): string {
  return normalise(process.env.APP_URL, FALLBACK, "APP_URL");
}

/** Where a team link points. `ADMIN_URL`, falling back to the client host. */
export function adminBase(): string {
  return normalise(process.env.ADMIN_URL, clientBase(), "ADMIN_URL");
}

export function hostnameOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * The two hostnames, when they are genuinely different. Null means one host,
 * and the proxy then refuses nothing on the grounds of which name was used.
 */
export function splitHosts(): { client: string; admin: string } | null {
  const client = hostnameOf(clientBase());
  const admin = hostnameOf(adminBase());
  if (!client || !admin || client === admin) return null;
  return { client, admin };
}
