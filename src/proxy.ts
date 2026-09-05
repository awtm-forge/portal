import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * PORTAL-SPEC 3.1 and criteria 18 and 19. Every response in the client,
 * admin and printable zones carries noindex and no-store, whatever the page
 * itself does. next.config headers() cover the same paths; this is the
 * belt to that pair of braces, because Next sets its own Cache-Control on
 * dynamic pages.
 */
export function proxy(_request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const config = {
  matcher: ["/p/:path*", "/admin/:path*", "/invoice/:path*", "/agreement/:path*", "/api/:path*"],
};
