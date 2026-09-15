import { redirect } from "next/navigation";
import { ClientShell } from "@/components/portal/ClientShell";
import { embedSrc } from "@/lib/booking";
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
      <div style={{ padding: "22px 0 14px" }} className="stack">
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

      <div style={{ padding: "16px 0 0" }} className="stack">
        <a className="btn-full ghost" href={booking} target="_blank" rel="noopener noreferrer">Open the calendar in a new tab</a>
        <p className="help" style={{ textAlign: "center", marginTop: 8 }}>
          {src ? "Use this if the calendar above does not load." : "The calendar opens on its own page."}
        </p>
      </div>
    </ClientShell>
  );
}
