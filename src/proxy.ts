import { NextResponse, type NextRequest } from "next/server";
import { splitHosts } from "@/lib/hosts";
import { REQUEST_ID_HEADER, newRequestId } from "@/lib/request-id";

/**
 * PORTAL-SPEC 3.1 and criteria 18 and 19. Every response in the client,
 * admin and printable zones carries noindex and no-store, whatever the page
 * itself does. next.config headers() cover the same paths; this is the
 * belt to that pair of braces, because Next sets its own Cache-Control on
 * dynamic pages.
 *
 * It also holds the two hostnames apart (ADR 0013). Each host answers for its
 * own zone only, so a client never sees an admin URL and the two sessions
 * cannot end up in one cookie jar. The printable routes answer on both,
 * because a client saves their own invoice from theirs and the team opens the
 * same document from theirs.
 *
 * And it stamps every request with an id, forwarded to the render and echoed
 * on the response, so a line in the log and a response in a browser can be
 * matched without guessing from timestamps. An id that arrives with the
 * request is kept, so a proxy in front of us stays in charge of it.
 */
export function proxy(request: NextRequest) {
  const hosts = splitHosts();
  if (hosts) {
    const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
    const path = request.nextUrl.pathname;

    // The bare team host is the projects list, not the "open your link" page.
    if (host === hosts.admin && path === "/") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    const wrongZone =
      (host === hosts.client && path.startsWith("/admin")) ||
      (host === hosts.admin && path.startsWith("/p/"));
    if (wrongZone) {
      // Not found rather than a redirect: the other host is not this host's
      // business to advertise.
      return new NextResponse("Not found", { status: 404, headers: PRIVATE });
    }
  }

  const requestId = request.headers.get(REQUEST_ID_HEADER) ?? newRequestId();
  const forwarded = new Headers(request.headers);
  forwarded.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({ request: { headers: forwarded } });
  for (const [key, value] of Object.entries(PRIVATE)) response.headers.set(key, value);
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

const PRIVATE = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
};

export const config = {
  matcher: ["/", "/healthz", "/p/:path*", "/admin/:path*", "/invoice/:path*", "/agreement/:path*", "/api/:path*"],
};
