import Link from "next/link";
import "./portal.css";
import { phoneDigits } from "@/lib/format";
import { navFor } from "@/modules/clients";
import { noticeCounts } from "@/modules/notifications/client";
import { company } from "@/modules/settings";
import { NavProgress } from "@/components/ui/NavProgress";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Toast } from "@/components/ui/Toast";
import { PortalMenu } from "./PortalMenu";

export type ClientPage = "home" | "questionnaire" | "agreement" | "review" | "invoices" | "thanks" | "day30" | "updates" | "book";

/**
 * Every client page sits in this, so a fix to the frame is a fix to all of
 * them. Rebuilt 13 Sep after an audit of the home page at 1440.
 *
 * The frame is a flex column at 100dvh with the footer last, so the page
 * always has a floor instead of ending in a dark void halfway down a laptop
 * screen. The content keeps a reading measure inside it.
 *
 * The header is the wordmark on the left and, on the right, the pages this
 * client actually has as plain text links, then one filled button. One primary
 * action, not two outlined buttons of equal weight arguing with each other.
 * Under 900 px the links fold into the menu and the button stays.
 *
 * The back and forward chevrons are gone. They were added on 12 Sep because a
 * client opens their link in WhatsApp's browser, which has little chrome; the
 * audit is right that inside a portal this small they read as browser furniture
 * and mean nothing. The wordmark goes home from every page and the menu lists
 * the rest, which is the same journey in words.
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
  const notices = nav ? await noticeCounts(nav.clientId) : { total: 0, unread: 0 };
  const home = nav ? `/p/${nav.token}` : null;
  const links: { key: ClientPage; label: string; href: string }[] = home && has
    ? [
        { key: "home", label: "Your project", href: home },
        ...(has.questionnaire ? [{ key: "questionnaire" as const, label: "Questionnaire", href: `${home}/intake` }] : []),
        ...(has.agreement ? [{ key: "agreement" as const, label: "Agreement", href: `${home}/agreement` }] : []),
        ...(has.review ? [{ key: "review" as const, label: "Delivery", href: `${home}/review` }] : []),
        ...(has.invoices ? [{ key: "invoices" as const, label: "Invoices", href: `${home}/invoices` }] : []),
      ]
    : [];
  const whatsapp = c.phone.trim() ? `https://wa.me/${phoneDigits(c.phone)}` : null;
  // Always resolvable to something. Signed in, with a booking link set, the
  // calendar has its own page inside the portal and the client never leaves;
  // otherwise it is the booking link itself, then a message asking for a time.
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
          {home ? (
            <Link className="c-brand" href={home}>awtm <b>forge</b></Link>
          ) : (
            <span className="c-brand">awtm <b>forge</b></span>
          )}

          {links.length > 1 && (
            <nav className="p-links" aria-label="Your pages">
              {links.map((l) => (
                <Link key={l.key} href={l.href} aria-current={l.key === nav?.current ? "page" : undefined}>
                  {l.label}
                </Link>
              ))}
            </nav>
          )}

          <div className="p-head-actions">
            {/* Only when there is a list to open, and never empty: a bell with
                nothing behind it is a control that does nothing. */}
            {home && notices.total > 0 && (
              <Link
                className="p-ctl p-ctl-icon p-bell"
                href={`${home}/updates`}
                aria-label={notices.unread > 0 ? `Updates, ${notices.unread} new` : "Updates"}
                aria-current={nav?.current === "updates" ? "page" : undefined}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
                {notices.unread > 0 && <span className="p-bell-dot">{notices.unread > 9 ? "9+" : notices.unread}</span>}
              </Link>
            )}
            <a className="p-cta" href={book} {...(bookExternal ? { target: "_blank", rel: "noopener" } : {})}>
              Book a meeting
            </a>
            {/* Beside the menu, not inside it: dark is the default and this is
                how a person asks for paper (Ayush, 13 Sep). */}
            <ThemeToggle />
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
            Stuck on anything, or just want to talk it through?{" "}
            {whatsapp ? <a href={whatsapp} target="_blank" rel="noopener">Message Rahul on WhatsApp</a> : "Message Rahul on WhatsApp"}
            {" "}or <a href={`mailto:${c.email}`}>email {c.email}</a>.
          </p>
          <p>This link is yours and does not expire. Nothing here will ever ask you for a password.</p>
        </div>
      </footer>
    </div>
  );
}
