import Link from "next/link";
import "@/components/portal/portal.css";
import { logoutAction } from "@/app/admin/(app)/actions";
import { HistoryNav } from "@/components/ui/HistoryNav";
import { NavProgress } from "@/components/ui/NavProgress";
import { NotifyBell } from "@/components/ui/NotifyBell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Toast } from "@/components/ui/Toast";
import { currentAdmin } from "@/modules/auth/admin";
import { teamBell } from "./team-bell";
import { markTeamNoticesSeen } from "@/components/portal/notify-actions";

/**
 * The admin frame: a sidebar on a laptop, a sticky top bar with the nav as a
 * scrollable row on a phone. All layout lives in portal.css (the admin block);
 * an inline style here once defeated the phone layout (D-02).
 *
 * Notifications are a bell, not a nav item. They were listed beside Clients,
 * Projects, Image library and Settings, which are places in the app you go to
 * and come back from. News is not a place: it arrives, you read it, it stops
 * being new (Ayush, 14 Sep). The bell sits at the page's top right corner,
 * carries its count, and is not rendered at all when there is nothing behind
 * it, which is the same rule the client's bell follows.
 *
 * The counts are read here rather than passed in, so the fourteen pages that
 * render this shell did not each have to learn about notifications.
 *
 * The history arrows and the bell are the page's, not the sidebar's: Back at
 * the top left corner of the pane, Forward and then the bell at the top right,
 * above the title, the arrows each with their name on a laptop (Ayush, 16
 * Sep). Four things in the sidebar's top row was two too many; it keeps the
 * wordmark, centred, and the theme switch.
 */
export async function AdminShell({
  active,
  adminName,
  children,
}: {
  active: "clients" | "projects" | "library" | "settings" | "notifications";
  adminName: string;
  children: React.ReactNode;
}) {
  const me = await currentAdmin();
  // Six in the tray; the rest are one link away on the page. The bell asks
  // the same helper's route to keep itself current (15 Sep).
  const bell = await teamBell(me);

  return (
    <div className="a-page">
      <NavProgress />
      <aside className="a-side">
        <div className="a-top">
          <Link className="a-brand" href="/admin">awtm <b>forge</b></Link>
          <div className="a-top-act">
            {/* Dark is the default in both zones (Ayush, 13 Sep). The bell
                that sat beside it is at the page's top right since 16 Sep. */}
            <ThemeToggle className="a-icon" />
          </div>
        </div>
        <nav className="a-navs" aria-label="Admin">
          <Link className={`a-nav${active === "clients" ? " on" : ""}`} href="/admin/clients" aria-current={active === "clients" ? "page" : undefined}>Clients</Link>
          <Link className={`a-nav${active === "projects" ? " on" : ""}`} href="/admin" aria-current={active === "projects" ? "page" : undefined}>Projects</Link>
          <Link className={`a-nav${active === "library" ? " on" : ""}`} href="/admin/library" aria-current={active === "library" ? "page" : undefined}>Image library</Link>
          <Link className={`a-nav${active === "settings" ? " on" : ""}`} href="/admin/settings" aria-current={active === "settings" ? "page" : undefined}>Settings</Link>
        </nav>
        <div className="signed">
          <span className="k">Signed in</span>
          <span className="mono-sm">{adminName}</span>
          <form action={logoutAction}><button className="link-mono signout" type="submit">Sign out</button></form>
        </div>
      </aside>
      <main className="a-main">
        {/* The way back and the way forward, at the two corners of the page,
            above its title, and the bell in the right corner beyond Forward
            (Ayush, 16 Sep). They sat in the sidebar's top row, which made
            four things in one short line; his idea was left and right of the
            page, and then the notifications on the right as well. The bell
            is not rendered at all when there is nothing behind it, so the
            row is often the two arrows alone. */}
        <div className="a-pagenav">
          <HistoryNav words />
          {me && (
            <NotifyBell
              className="a-icon"
              unread={bell.unread}
              items={bell.items}
              allHref="/admin/notifications"
              onOpen={markTeamNoticesSeen}
              pollHref="/admin/api/notices"
            />
          )}
        </div>
        {children}
      </main>
      <Toast />
    </div>
  );
}
