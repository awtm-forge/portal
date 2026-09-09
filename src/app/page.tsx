import Link from "next/link";
import "@/components/portal/portal.css";

/**
 * The way in. This host serves the portal and the admin, not the marketing
 * site: Rahul's decision on 9 September 2026, ADR 0012.
 *
 * A client never needs this page, because their link goes straight to their
 * own project. It is for whoever types the bare domain, and it tells them the
 * truth: the link is the way in, and there is no password to look for. It has
 * its own layout rather than the client column, because it is read on a laptop
 * as often as a phone.
 */
export const metadata = {
  title: "awtm forge",
  robots: { index: false, follow: false },
};

export default function Home() {
  return (
    <div className="wayin">
      <div className="wayin-head">
        <span className="c-brand">awtm <b>forge</b></span>
      </div>
      <div className="wayin-body">
        <div className="wayin-card">
          <p className="k">Your project</p>
          <h1>Open the link we sent you</h1>
          <p className="lede">
            Your project page opens from the link we emailed you. It does not expire, and there is no
            password. If you cannot find it, message Rahul on WhatsApp.
          </p>
          <div className="wayin-team">
            <Link href="/admin">Team sign in</Link>
            <span>awtm forge only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
