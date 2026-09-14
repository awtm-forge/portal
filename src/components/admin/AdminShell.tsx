import Link from "next/link";
import "@/components/portal/portal.css";
import { logoutAction } from "@/app/admin/(app)/actions";
import { HistoryNav } from "@/components/ui/HistoryNav";
import { NavProgress } from "@/components/ui/NavProgress";
import { NotifyBell } from "@/components/ui/NotifyBell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Toast } from "@/components/ui/Toast";
import { currentAdmin } from "@/modules/auth/admin";
import { teamCounts, teamFeed } from "@/modules/notifications/team";
import { markTeamNoticesSeen } from "@/components/portal/notify-actions";
import { dayMonthTime } from "@/lib/dates";

/**
 * The admin frame: a sidebar on a laptop, a sticky top bar with the nav as a
 * scrollable row on a phone. All layout lives in portal.css (the admin block);
 * an inline style here once defeated the phone layout (D-02).
 *
 * Notifications are a bell, not a nav item. They were listed beside Clients,
 * Projects, Image library and Settings, which are places in the app you go to
 * and come back from. News is not a place: it arrives, you read it, it stops
 * being new (Ayush, 14 Sep). The bell sits with the other two controls at the
 * top, carries its count, and is not rendered at all when there is nothing
 * behind it, which is the same rule the client's bell follows.
 *
 * The counts are read here rather than passed in, so the fourteen pages that
 * render this shell did not each have to learn about notifications.
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
  const notices = me ? await teamCounts(me.notificationsSeenAt ?? null) : { total: 0, unread: 0 };
  // Six in the tray; the rest are one link away on the page.
  const recent = me && notices.total > 0 ? await teamFeed(me.notificationsSeenAt ?? null, 6) : [];

  return (
    <div className="a-page">
      <NavProgress />
      <aside className="a-side">
        <div className="a-top">
          <HistoryNav />
          <Link className="a-brand" href="/admin">awtm <b>forge</b></Link>
          <div className="a-top-act">
            {notices.total > 0 && (
              <NotifyBell
                className="a-icon"
                unread={notices.unread}
                allHref="/admin/notifications"
                onOpen={markTeamNoticesSeen}
                items={recent.map((n) => ({
                  id: n.id,
                  title: n.subject,
                  body: n.body,
                  href: n.path,
                  when: dayMonthTime(n.at),
                  unread: n.unread,
                }))}
              />
            )}
            {/* Beside the bell, where the client's sits beside the menu. Dark
                is the default in both zones (Ayush, 13 Sep). */}
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
      <main className="a-main">{children}</main>
      <Toast />
    </div>
  );
}
