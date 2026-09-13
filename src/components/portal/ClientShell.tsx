import Link from "next/link";
import "./portal.css";
import { phoneDigits } from "@/lib/format";
import { navFor } from "@/modules/clients";
import { unreadCount } from "@/modules/notifications/client";
import { company } from "@/modules/settings";
import { HistoryNav } from "@/components/ui/HistoryNav";
import { NavProgress } from "@/components/ui/NavProgress";
import { Toast } from "@/components/ui/Toast";
import { PortalMenu } from "./PortalMenu";

export type ClientPage = "home" | "questionnaire" | "agreement" | "review" | "invoices" | "thanks" | "day30" | "updates" | "book";

/**
 * Every client page sits in this. The shell spans the window and the content
 * keeps a readable measure inside it, so the page works on a laptop as well
 * as a phone (portal.css, the client shell block).
 *
 * The header carries the wordmark only: the client's own name belongs in the
 * body as the heading, not up here (item 3, a proper hierarchy). Two things
 * are on every page: a persistent "Book a meeting" and a "Reach us" with the
 * team's WhatsApp and email (items 9 and Q15), so a client is never more than
 * one tap from a person. The quiet row of links below names the pages that
 * already exist for this client.
 */
export async function ClientShell({
  businessName,
  wide = false,
  nav,
  children,
}: {
  businessName: string;
  /** The questionnaire, which is a form and wants more room than prose. */
  wide?: boolean;
  /** Signed in: which client, and which of their pages this is. */
  nav?: { token: string; clientId: string; current: ClientPage };
  children: React.ReactNode;
}) {
  const c = await company();
  const has = nav ? await navFor(nav.clientId) : null;
  const unread = nav ? await unreadCount(nav.clientId) : 0;
  const home = nav ? `/p/${nav.token}` : null;
  const links: { key: ClientPage; label: string; href: string }[] = home && has
    ? [
        { key: "home", label: "Your page", href: home },
        ...(has.questionnaire ? [{ key: "questionnaire" as const, label: "Questionnaire", href: `${home}/intake` }] : []),
        ...(has.agreement ? [{ key: "agreement" as const, label: "Agreement", href: `${home}/agreement` }] : []),
        ...(has.review ? [{ key: "review" as const, label: "Review", href: `${home}/review` }] : []),
        ...(has.invoices ? [{ key: "invoices" as const, label: "Invoices", href: `${home}/invoices` }] : []),
      ]
    : [];
  const whatsapp = c.phone.trim() ? `https://wa.me/${phoneDigits(c.phone)}` : null;
  // Always resolvable to something (item 9). Signed in, with a booking link
  // set, the calendar has its own page inside the portal and the client never
  // leaves; otherwise it is the booking link itself, then a message asking for
  // a time, then email.
  const booking = c.bookingUrl?.trim() ?? "";
  const inPortal = Boolean(home && booking);
  const book = inPortal
    ? `${home}/book`
    : booking
      ? booking
      : whatsapp
        ? `${whatsapp}?text=${encodeURIComponent("Hi, I would like to book a quick meeting.")}`
        : `mailto:${c.email}?subject=${encodeURIComponent("Booking a meeting")}`;
  const bookExternal = !inPortal && !book.startsWith("mailto:");

  return (
    <div className={`p-shell${wide ? " p-wide" : ""}`}>
      <NavProgress />
      <span className="visually-hidden">{businessName}</span>
      <header className="p-head">
        <div className="p-head-in">
          {home && <HistoryNav />}
          {home ? (
            <Link className="c-brand" href={home}>awtm <b>forge</b></Link>
          ) : (
            <span className="c-brand">awtm <b>forge</b></span>
          )}
          <div className="p-head-actions">
            {/* Outside the menu on purpose: news is time sensitive, so the
                count is visible and one tap away (Ayush, 13 Sep). */}
            {home && (
              <Link
                className="p-bell"
                href={`${home}/updates`}
                aria-label={unread > 0 ? `Updates, ${unread} new` : "Updates"}
                aria-current={nav?.current === "updates" ? "page" : undefined}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
                {unread > 0 && <span className="p-bell-dot">{unread > 9 ? "9+" : unread}</span>}
              </Link>
            )}
            <a className="p-pill book-pill" href={book} aria-label="Book a meeting" {...(bookExternal ? { target: "_blank", rel: "noopener" } : {})}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 11h18" /></svg>
              <span className="book-txt">Book a meeting</span>
            </a>
            {home && (
              <PortalMenu
                pages={links.map((l) => ({ key: l.key, label: l.label, href: l.href, current: l.key === nav?.current }))}
                whatsapp={whatsapp}
                email={c.email}
              />
            )}
          </div>
        </div>
      </header>
      <main className="p-body">{children}</main>
      <Toast />
      <footer className="p-foot">
        <div className="p-foot-in">
          <p>
            Stuck on anything, or just want to talk it through:{" "}
            {whatsapp ? <a href={whatsapp} target="_blank" rel="noopener">message Rahul on WhatsApp</a> : "message Rahul on WhatsApp"}
            {" "}or <a href={`mailto:${c.email}`}>email {c.email}</a>.
          </p>
          <p>This page is yours and the link does not expire. Nothing here will ever ask you for a password.</p>
        </div>
      </footer>
    </div>
  );
}
