import Link from "next/link";
import "@/components/portal/portal.css";

/**
 * The way in. This host serves the portal and the admin, not the marketing
 * site: Rahul's decision on 9 Sep 2026, ADR 0012. The marketing site is kept
 * whole in components/marketing and is not routed.
 *
 * A client never needs this page, because their link goes straight to their
 * own project. It is here for the person who types the bare domain, and it
 * tells them the truth: the link is the way in, and there is no password to
 * look for.
 */
export const metadata = {
  title: "awtm forge",
  robots: { index: false, follow: false },
};

export default function Home() {
  return (
    <div className="c-page" style={{ maxWidth: 460 }}>
      <div className="c-head">
        <span className="c-brand">awtm <b>forge</b></span>
      </div>
      <div style={{ padding: "38px 20px" }} className="stack">
        <p className="k">Your project</p>
        <h1 className="c-title" style={{ fontSize: 24, marginTop: 8 }}>Open the link we sent you</h1>
        <p className="c-sub" style={{ lineHeight: 1.7 }}>
          Your project page opens from the link that came by email, and it does not expire. There is no
          password to remember. If you cannot find the link, message Rahul on WhatsApp and he will send it again.
        </p>
        <p className="help" style={{ paddingTop: 18, borderTop: "1px solid var(--rule-soft)" }}>
          <Link href="/admin">Team sign in</Link>
        </p>
      </div>
    </div>
  );
}
