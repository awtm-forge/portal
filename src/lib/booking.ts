/**
 * The booking link, dressed for whoever is opening it (15 Sep).
 *
 * Only a cal.com address is rewritten, and only with cal.com's own parameters.
 * Anything else is passed on exactly as it was pasted, because a URL we do not
 * understand is not one we should be bolting query strings onto: a Google
 * appointment schedule carries its own embed parameter in the address Google
 * hands you, and adding ours to it is noise at best.
 *
 * Null when the setting is not an https URL at all, in which case the page
 * shows the way out and no frame, rather than an empty box.
 */

/**
 * The booking page with the client's own name and email filled in, so they do
 * not retype what we already know. The same link serves the team: opened from
 * a client's admin page it books on that client's behalf, and the invite goes
 * to the client, because their email is the one on the booking. Both go to
 * the service they are about to book with, and nothing else about them
 * travels.
 */
export function bookingLink(booking: string, name: string, email: string): string | null {
  try {
    const u = new URL(booking);
    if (u.protocol !== "https:") return null;
    if (!isCalCom(u)) return u.toString();
    if (name.trim()) u.searchParams.set("name", name.trim());
    if (email.trim()) u.searchParams.set("email", email.trim());
    return u.toString();
  } catch {
    return null;
  }
}

/** The same link, in embed dress, for the frame on the client's booking page. */
export function embedSrc(booking: string, name: string, email: string): string | null {
  const link = bookingLink(booking, name, email);
  if (link === null) return null;
  const u = new URL(link);
  if (!isCalCom(u)) return link;

  // Not embed=true: that mode stays blank until cal.com's own script talks to
  // it from the parent page, and their script is the thing we are not
  // loading. The ordinary booking page frames perfectly well on its own.
  //
  // theme is advisory, and on a direct page load cal.com ignores it and
  // follows the device's own light or dark setting: a client on a light
  // phone gets a white calendar inside this dark page. Checked on 12 Sep
  // against theme, ui.theme and ui[theme]; none of them move it. The control
  // that does work is the appearance setting inside cal.com itself.
  u.searchParams.set("theme", "dark");
  u.searchParams.set("layout", "month_view");
  return u.toString();
}

/** The host itself or a subdomain of it, never a host that merely ends the same way. */
function isCalCom(u: URL): boolean {
  return u.hostname === "cal.com" || u.hostname.endsWith(".cal.com");
}
