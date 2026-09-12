import { redirect } from "next/navigation";
import { ClientShell } from "@/components/portal/ClientShell";
import { company } from "@/modules/settings";
import { clientScope } from "../scope";

/**
 * Booking a sync, inside the portal rather than away from it (Ayush, 12 Sep,
 * replacing the plain link in CLAUDE.md section 5).
 *
 * The calendar is cal.com's own page in an iframe, not their embed script. A
 * script would run inside the page that holds the client's session; an iframe
 * is a separate origin and can reach neither the DOM nor the cookies. The
 * client zone sends Referrer-Policy: no-referrer, so the access token in this
 * page's URL never reaches cal.com either.
 *
 * There is always a way out to the booking page itself, because an iframe is
 * the one part of this portal whose loading we do not control.
 */
export default async function BookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await clientScope(token);
  const c = await company();
  const booking = c.bookingUrl?.trim();
  // Nothing to show if no booking link is set: the header pill falls back to
  // WhatsApp or email in that case and never points here.
  if (!booking) redirect(`/p/${token}`);

  const src = embedSrc(booking, client.contactName, client.contactEmail);

  return (
    <ClientShell businessName={client.businessName} nav={{ token, clientId: client.id, current: "book" }} wide>
      <div style={{ padding: "22px 20px 14px" }} className="stack">
        <p className="k">Book a meeting</p>
        <h1 className="c-title" style={{ fontSize: 26, marginTop: 8 }}>Pick a time that suits you</h1>
        <p className="c-sub" style={{ marginTop: 10 }}>
          Choose a slot and the invite comes to you by email, with the call link on it. If nothing here works, message
          Rahul and we will find a time between us.
        </p>
      </div>

      {src && (
        <div className="bookframe">
          <iframe src={src} title="Pick a time" loading="lazy" referrerPolicy="no-referrer" />
        </div>
      )}

      <div style={{ padding: "16px 20px 0" }} className="stack">
        <a className="btn-full ghost" href={booking} target="_blank" rel="noopener noreferrer">Open the calendar in a new tab</a>
        <p className="help" style={{ textAlign: "center", marginTop: 8 }}>
          {src ? "Use this if the calendar above does not load." : "The calendar opens on its own page."}
        </p>
      </div>
    </ClientShell>
  );
}

/**
 * The booking page in embed dress, with the client's own name and email filled
 * in so they do not retype what we already know. Both go to the service they
 * are about to book with, and nothing else about them travels.
 *
 * Null when the setting is not a URL at all, in which case the page shows the
 * way out and no frame, rather than an empty box.
 */
function embedSrc(booking: string, name: string, email: string): string | null {
  try {
    const u = new URL(booking);
    if (u.protocol !== "https:") return null;
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
    if (name.trim()) u.searchParams.set("name", name.trim());
    if (email.trim()) u.searchParams.set("email", email.trim());
    return u.toString();
  } catch {
    return null;
  }
}
