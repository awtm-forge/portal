import Link from "next/link";
import { ClientShell } from "@/components/portal/ClientShell";
import { Empty } from "@/components/ui/Empty";
import { Fold } from "@/components/ui/Fold";
import { dayMonthTime, dayMonthYear, isoDate } from "@/lib/dates";
import { listForClient, markAllRead } from "@/modules/notifications/client";
import { clientScope } from "../scope";

const SHOWN = 60;

/**
 * The client's notifications (Q19): the moments we told them about, newest
 * first and grouped by day, unread ones marked. Opening the page marks them
 * read, which is what clears the bell. After sixty the rest fold away (F-14).
 */
export default async function UpdatesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await clientScope(token);
  const items = await listForClient(client.id, 400);
  await markAllRead(client.id);

  const recent = items.slice(0, SHOWN);
  const older = items.slice(SHOWN);
  const now = new Date();
  const today = isoDate(now);
  const yesterday = isoDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const dayLabel = (at: Date) => {
    const day = isoDate(at);
    return day === today ? "Today" : day === yesterday ? "Yesterday" : dayMonthYear(at);
  };

  const groups: { label: string; items: typeof items }[] = [];
  for (const n of recent) {
    const label = dayLabel(n.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }

  const row = (n: (typeof items)[number]) => (
    <Link key={n.id} className={`notice${n.readAt ? " read" : " unread"}`} href={`/p/${token}${n.path}`}>
      <div className="notice-top">
        <span className="notice-title">{n.title}</span>
        <span className="help" style={{ flex: "none" }}>{dayMonthTime(n.createdAt)}</span>
      </div>
      <p className="notice-body">{n.body}</p>
    </Link>
  );

  return (
    <ClientShell businessName={client.businessName} nav={{ token, clientId: client.id, current: "updates" }}>
      <div style={{ padding: "22px 20px 16px" }} className="stack">
        <p className="k">Notifications</p>
        <h1 className="c-title" style={{ fontSize: 26, marginTop: 8 }}>Updates</h1>
      </div>
      <div style={{ padding: "0 20px", gap: 10 }} className="stack">
        {items.length === 0 ? (
          <Empty title="Nothing yet" line="Whenever something needs you or changes, it turns up here, and we email you too." />
        ) : (
          groups.map((g) => (
            <div key={g.label} className="stack" style={{ gap: 8 }}>
              <p className="notice-day">{g.label}</p>
              {g.items.map(row)}
            </div>
          ))
        )}
        {older.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <Fold title="Older" fact={String(older.length)}>
              <div className="stack" style={{ gap: 8 }}>{older.map(row)}</div>
            </Fold>
          </div>
        )}
      </div>
    </ClientShell>
  );
}
