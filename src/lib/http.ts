import { NextResponse } from "next/server";

/** CSRF guard for route handlers that change state: same origin only. */
export function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    try { return new URL(origin).host === host; } catch { return false; }
  }
  return true;
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(message: string, status = 400): NextResponse {
  return json({ ok: false, message }, status);
}
