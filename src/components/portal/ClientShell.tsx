import Link from "next/link";
import "./portal.css";
import { phoneDigits } from "@/lib/format";
import { navFor } from "@/modules/clients";
import { company } from "@/modules/settings";

export type ClientPage = "home" | "questionnaire" | "agreement" | "review" | "invoices" | "thanks" | "day30";

/**
 * Every client page sits in this. The shell spans the window and the content
 * keeps a readable measure inside it, so the page works on a laptop as well
 * as a phone (portal.css, the client shell block).
 *
 * Two things are on every page (QUESTIONS.md Q15): a quiet row of links to
 * the pages that exist for this client, and one "Reach us" control with the
 * team's WhatsApp and email. Neither is a thing to do: the one loud action
 * on a page stays in the body, and the row lists only what is already there.
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

  return (
    <div className={`p-shell${wide ? " p-wide" : ""}`}>
      <header className="p-head">
        <div className="p-head-in">
          {home ? (
            <Link className="c-brand" href={home}>awtm <b>forge</b></Link>
          ) : (
            <span className="c-brand">awtm <b>forge</b></span>
          )}
          <span className="k p-biz">{businessName}</span>
          <details className="reach">
            <summary>Reach us</summary>
            <div className="reach-menu">
              {whatsapp && <a href={whatsapp} target="_blank" rel="noopener">WhatsApp Rahul</a>}
              <a href={`mailto:${c.email}`}>Email {c.email}</a>
              <p>Any time, about anything on this page.</p>
            </div>
          </details>
        </div>
        {links.length > 1 && (
          <nav className="p-nav" aria-label="Your pages">
            <div className="p-nav-in">
              {links.map((l) => (
                <Link key={l.key} href={l.href} aria-current={l.key === nav?.current ? "page" : undefined}>{l.label}</Link>
              ))}
            </div>
          </nav>
        )}
      </header>
      <main className="p-body">{children}</main>
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
