import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * A one-line confirmation for the next page, shown once as a toast. The cookie
 * is readable by the page on purpose, because the page is what clears it
 * (cookies cannot be changed during a render); so it never carries anything
 * private, only words like "Marked paid". Server actions and route handlers.
 */
export const FLASH_COOKIE = "awtm_flash";

export async function flash(message: string): Promise<void> {
  (await cookies()).set(FLASH_COOKIE, message.slice(0, 200), {
    httpOnly: false,
    sameSite: "lax",
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: 60,
  });
}

/**
 * A redirect after a form post to a route handler, with the line for the next
 * page (16 Sep). The Location is relative on purpose: in a production build
 * `request.url` names the server, not the host the browser is on, and a
 * redirect built from it sent the suite's browser from 127.0.0.1 to localhost,
 * where its session cookie did not follow. On the live host that would have
 * been a jump to "localhost". A relative Location stays wherever the person
 * already is. The cookie goes on this response rather than through cookies(),
 * so nothing depends on how a plain Response is post-processed.
 */
export function redirectWithFlash(path: string, message: string): NextResponse {
  const res = new NextResponse(null, { status: 303, headers: { Location: path } });
  res.cookies.set(FLASH_COOKIE, message.slice(0, 200), {
    httpOnly: false,
    sameSite: "lax",
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: 60,
  });
  return res;
}
