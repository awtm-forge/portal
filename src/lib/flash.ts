import { cookies } from "next/headers";

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
