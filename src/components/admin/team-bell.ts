import { dayMonthTime } from "@/lib/dates";
import type { Notice } from "@/components/ui/NotifyBell";
import { teamCounts, teamFeed } from "@/modules/notifications/team";

/**
 * What the team's bell shows, built once here so the shell that renders it
 * and the route that refreshes it cannot drift (15 Sep). Six in the tray;
 * the rest are one link away on the page.
 */
export type BellData = { total: number; unread: number; items: Notice[] };

export async function teamBell(me: { notificationsSeenAt: Date | null } | null): Promise<BellData> {
  if (!me) return { total: 0, unread: 0, items: [] };
  const seenAt = me.notificationsSeenAt ?? null;
  const counts = await teamCounts(seenAt);
  const recent = counts.total > 0 ? await teamFeed(seenAt, 6) : [];
  return {
    ...counts,
    items: recent.map((n) => ({ id: n.id, title: n.subject, body: n.body, href: n.path, when: dayMonthTime(n.at), unread: n.unread })),
  };
}
