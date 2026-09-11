import Link from "next/link";
import "@/components/portal/portal.css";

/**
 * The way in. This host serves the portal and the admin, not the marketing
 * site: Rahul's decision on 9 September 2026, ADR 0012.
 *
 * A client's link goes straight to their own page, so this is for whoever
 * types the bare domain: most often a client on a new phone without the
 * email to hand. The one action is the login by email (F-10); the team's
 * sign-in stays as a small link. It has its own layout rather than the
 * client column, because it is read on a laptop as often as a phone.
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
          <h1>Your page is one code away</h1>
          <p className="lede">
            The link we emailed you opens your page straight away, and it does not expire. Without it, log in
            with the email you gave us and we will send a six digit code. There is no password, now or ever.
          </p>
          <Link className="btn-full" href="/p/login">Log in with your email</Link>
          <div className="wayin-team">
            <Link href="/admin">Team sign in</Link>
            <span>awtm forge only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
