import Link from "next/link";
import { ClientShell } from "@/components/portal/ClientShell";
import { dayMonthTime } from "@/lib/dates";
import { listForClient, markAllRead } from "@/modules/notifications/client";
import { clientScope } from "../scope";

/**
 * The client's notifications (Q19): the moments we told them about, newest
 * first, unread ones marked. Opening the page marks them read, which is what
 * clears the bell.
 */
export default async function UpdatesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await clientScope(token);
  const items = await listForClient(client.id);
  await markAllRead(client.id);

  return (
    <ClientShell businessName={client.businessName} nav={{ token, clientId: client.id, current: "updates" }}>
      <div style={{ padding: "22px 20px 16px" }} className="stack">
        <p className="k">Notifications</p>
        <h1 className="c-title" style={{ fontSize: 26, marginTop: 8 }}>Updates</h1>
      </div>
      <div style={{ padding: "0 20px", gap: 10 }} className="stack">
        {items.length === 0 ? (
          <div className="card stand">
            <p>Nothing yet. Whenever something needs you or changes, it turns up here, and we email you too.</p>
          </div>
        ) : (
          items.map((n) => (
            <Link key={n.id} className={`notice${n.readAt ? "" : " unread"}`} href={`/p/${token}${n.path}`}>
              <div className="notice-top">
                <span className="notice-title">{n.title}</span>
                <span className="help" style={{ flex: "none" }}>{dayMonthTime(n.createdAt)}</span>
              </div>
              <p className="notice-body">{n.body}</p>
            </Link>
          ))
        )}
      </div>
    </ClientShell>
  );
}
