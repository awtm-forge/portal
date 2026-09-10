import { headers } from "next/headers";
import { adminBase, clientBase, hostnameOf, splitHosts } from "@/lib/hosts";

/**
 * The scheme and host the current request actually arrived on, or null when
 * there is no request (a script, a test, the seed) or no usable host header.
 * Behind Hostinger's TLS proxy the app sees `x-forwarded-host` and
 * `x-forwarded-proto`; the plain `host` header is the fallback.
 */
async function requestOrigin(): Promise<string | null> {
  try {
    const h = await headers();
    const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
    if (!host || !hostnameOf(`https://${host}`)) return null;
    const isLocal = /^(localhost|127\.|\[?::1)/i.test(host);
    const proto = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() || (isLocal ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return null;
  }
}

/**
 * Where a link handed to a person should point (ADR 0013, and QUESTIONS.md
 * Q16). On a single host the link points back at the host the request came in
 * on, which is provably reachable: this is what keeps a link working when
 * APP_URL names a host that has no DNS yet, as on 10 September 2026 when
 * production ran on dashboard.awtmforge.com while APP_URL still named
 * portal.awtmforge.com. When the two hosts are genuinely split, the configured
 * base wins, because a client link must name the client host even when it is
 * built on the admin one.
 */
export async function adminUrl(path: string): Promise<string> {
  const base = splitHosts() ? adminBase() : (await requestOrigin()) ?? adminBase();
  return `${base}${path}`;
}

export async function clientUrl(path: string): Promise<string> {
  const base = splitHosts() ? clientBase() : (await requestOrigin()) ?? clientBase();
  return `${base}${path}`;
}
