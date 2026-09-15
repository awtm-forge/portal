import Link from "next/link";
import "./portal.css";
import { phoneDigits } from "@/lib/format";
import { navFor } from "@/modules/clients";
import { clientBell } from "./client-bell";
import { company } from "@/modules/settings";
import { NavProgress } from "@/components/ui/NavProgress";
import { NotifyBell } from "@/components/ui/NotifyBell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Toast } from "@/components/ui/Toast";
import { markClientNoticesSeen } from "./notify-actions";
import { PortalMenu } from "./PortalMenu";

export type ClientPage = "home" | "questionnaire" | "agreement" | "review" | "invoices" | "files" | "thanks" | "day30" | "updates" | "book";

/**
 * Every client page sits in this, so a fix to the frame is a fix to all of
 * them. Rebuilt 13 Sep after an audit of the home page at 1440.
 *
 * The frame is a flex column at 100dvh with the footer last, so the page
 * always has a floor instead of ending in a dark void halfway down a laptop
 * screen. The content keeps a reading measure inside it.
 *
 * The header is the wordmark on the left and, on the right, the notifications,
 * one filled button, the theme and the menu. One primary action, not two
 * outlined buttons of equal weight arguing with each other.
 *
 * The client's pages are a vertical list inside the menu at every width, not a
 * row strung across the bar (Ayush, 14 Sep). A row read as five things to do
 * beside the one thing that is; a list reads as places, which is what they are.
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
  const home = nav ? `/p/${nav.token}` : null;
  // Six in the tray; the rest are one link away on the page. The bell asks
  // the same helper's route to keep itself current (15 Sep).
  const bell = nav && home ? await clientBell(nav.clientId, home) : null;
  const links: { key: ClientPage; label: string; href: string }[] = home && has
    ? [
        { key: "home", label: "Your project", href: home },
        ...(has.questionnaire ? [{ key: "questionnaire" as const, label: "Questionnaire", href: `${home}/intake` }] : []),
        ...(has.agreement ? [{ key: "agreement" as const, label: "Agreement", href: `${home}/agreement` }] : []),
        ...(has.review ? [{ key: "review" as const, label: "Delivery", href: `${home}/review` }] : []),
        ...(has.invoices ? [{ key: "invoices" as const, label: "Invoices", href: `${home}/invoices` }] : []),
        // Always there once signed in: a place for anything they want us to
        // have, and for anything we hand them (ADR 0025).
        { key: "files" as const, label: "Your files", href: `${home}/files` },
      ]
    : [];
  const whatsapp = c.phone.trim() ? `https://wa.me/${phoneDigits(c.phone)}` : null;
  // Booking is for a client who is signed in, and for nobody else (Ayush,
  // 15 Sep). It used to sit on the code screen too, where it asked a person
  // who had not proved who they are to go and book time with us, and took them
  // off the portal at the one moment they were trying to get into it.
  //
  // Signed in, with a booking link set, the calendar has its own page inside
  // the portal and the client never leaves; otherwise it is the booking link
  // itself, then a message asking for a time.
  const booking = c.bookingUrl?.trim() ?? "";
  const inPortal = Boolean(home && booking);
  const book = !home
    ? null
    : inPortal
      ? `${home}/book`
      : booking
        ? booking
        : whatsapp
          ? `${whatsapp}?text=${encodeURIComponent("Hi, I would like to book a quick meeting.")}`
          : `mailto:${c.email}?subject=${encodeURIComponent("Booking a meeting")}`;
  const bookExternal = book !== null && !inPortal && !book.startsWith("mailto:");

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

          <div className="p-head-actions">
            {/* Never empty: the bell hides itself until something is behind
                it, and appears on its own when the first notice lands. */}
            {home && bell && (
              <NotifyBell
                unread={bell.unread}
                items={bell.items}
                allHref={`${home}/updates`}
                onOpen={markClientNoticesSeen}
                pollHref={`${home}/api/notices`}
              />
            )}
            {book && (
              <a className="p-cta" href={book} {...(bookExternal ? { target: "_blank", rel: "noopener" } : {})}>
                Book a meeting
              </a>
            )}
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
