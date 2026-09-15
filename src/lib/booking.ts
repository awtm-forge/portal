/**
 * The booking page in embed dress.
 *
 * Only a cal.com address is rewritten, and only with cal.com's own parameters.
 * Anything else is framed exactly as it was pasted, because a URL we do not
 * understand is not one we should be bolting query strings onto: a Google
 * appointment schedule carries its own embed parameter in the address Google
 * hands you, and adding theme and layout to it is noise at best (15 Sep).
 *
 * Null when the setting is not an https URL at all, in which case the page
 * shows the way out and no frame, rather than an empty box.
 */
export function embedSrc(booking: string, name: string, email: string): string | null {
  try {
    const u = new URL(booking);
    if (u.protocol !== "https:") return null;
    if (!isCalCom(u)) return u.toString();

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
    // The client's own name and email, so they do not retype what we already
    // know. Both go to the service they are about to book with, and nothing
    // else about them travels.
    if (name.trim()) u.searchParams.set("name", name.trim());
    if (email.trim()) u.searchParams.set("email", email.trim());
    return u.toString();
  } catch {
    return null;
  }
}

/** The host itself or a subdomain of it, never a host that merely ends the same way. */
function isCalCom(u: URL): boolean {
  return u.hostname === "cal.com" || u.hostname.endsWith(".cal.com");
}
