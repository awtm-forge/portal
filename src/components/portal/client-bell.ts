import { dayMonthTime } from "@/lib/dates";
import type { Notice } from "@/components/ui/NotifyBell";
import { listForClient, noticeCounts } from "@/modules/notifications/client";

/**
 * What a client's bell shows, built once here so the shell that renders it
 * and the route that refreshes it cannot drift (15 Sep). Six in the tray;
 * the rest are one link away on the updates page.
 */
export type BellData = { total: number; unread: number; items: Notice[] };

export async function clientBell(clientId: string, home: string): Promise<BellData> {
  const counts = await noticeCounts(clientId);
  const recent = counts.total > 0 ? await listForClient(clientId, 6) : [];
  return {
    ...counts,
    items: recent.map((n) => ({ id: n.id, title: n.title, body: n.body, href: `${home}${n.path}`, when: dayMonthTime(n.createdAt), unread: n.readAt === null })),
  };
}
