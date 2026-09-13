import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { Empty } from "@/components/ui/Empty";
import { dayMonthTime, dayMonthYear, isoDate } from "@/lib/dates";
import { requireAdmin } from "@/modules/auth/admin";
import { markTeamSeen, teamFeed } from "@/modules/notifications/team";

/**
 * What the clients have done, newest first (ADR 0020). The same sentences the
 * team is emailed, in one place, so nobody has to keep an inbox open to know
 * where things stand. Opening the page marks it read, like the client's own.
 *
 * It is not the needs-attention block above the projects: that says what is
 * going wrong right now, worked out from dates. This says what happened.
 */
export default async function NotificationsPage() {
  const admin = await requireAdmin();
  const items = await teamFeed(admin.notificationsSeenAt ?? null);
  // Read the list first, then move the marker: anything that arrives while
  // this renders stays new rather than being silently swallowed.
  await markTeamSeen(admin.id);

  const now = new Date();
  const today = isoDate(now);
  const yesterday = isoDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const dayLabel = (at: Date) => {
    const day = isoDate(at);
    return day === today ? "Today" : day === yesterday ? "Yesterday" : dayMonthYear(at);
  };

  const groups: { label: string; items: typeof items }[] = [];
  for (const n of items) {
    const label = dayLabel(n.at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }

  return (
    <AdminShell active="notifications" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="a-title">Notifications</h1>
        <p className="a-sub">Everything a client has done, newest first. The same lines that go to the team address.</p>
      </div>

      {items.length === 0 ? (
        <Empty title="Nothing yet" line="When a client sends their questionnaire, agrees, asks for a change, signs off or answers at day 30, it appears here." />
      ) : (
        groups.map((g) => (
          <div key={g.label} className="stack" style={{ gap: 8 }}>
            <p className="k">{g.label}</p>
            {g.items.map((n) => (
              <Link key={n.id} className={`notice${n.unread ? " unread" : " read"}`} href={n.path}>
                <div className="notice-top">
                  <span className="notice-title">{n.subject}</span>
                  <span className="help" style={{ flex: "none" }}>{dayMonthTime(n.at)}</span>
                </div>
                <p className="notice-body" style={{ whiteSpace: "pre-wrap" }}>{n.body}</p>
              </Link>
            ))}
          </div>
        ))
      )}
    </AdminShell>
  );
}
