import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataList } from "@/components/ui/DataList";
import { Empty } from "@/components/ui/Empty";
import { db } from "@/lib/db";
import { dayMonth } from "@/lib/dates";
import { requireAdmin } from "@/modules/auth/admin";
import { PHASE_LABEL } from "@/modules/projects/phase";

export default async function ClientsPage() {
  const admin = await requireAdmin();
  const clients = await db.client.findMany({
    orderBy: { createdAt: "desc" },
    include: { projects: { orderBy: { createdAt: "desc" } } },
  });
  const waiting = clients.filter((c) => !c.linkEmailedAt).length;

  return (
    <AdminShell active="clients" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="a-title">Clients</h1>
        <p className="a-sub">
          {clients.length} {clients.length === 1 ? "client" : "clients"}
          {waiting > 0 ? `. ${waiting} with a link that has not gone out.` : "."}
        </p>
      </div>

      <div className="a-card">
        <div className="between"><span className="k">All clients</span><Link className="a-btn" href="/admin/clients/new">Add a client</Link></div>
        {clients.length === 0 ? (
          <Empty title="No clients yet" line="The first one is added straight after a discovery call." />
        ) : (
          <DataList
            caption="Clients"
            columns={[
              { key: "business", label: "Business" },
              { key: "contact", label: "Who we talk to" },
              { key: "projects", label: "Projects" },
              { key: "added", label: "Added", num: true },
            ]}
            rows={clients.map((c) => ({
              key: c.id,
              href: `/admin/clients/${c.id}`,
              cells: {
                business: c.businessName,
                contact: (
                  <span className="stack" style={{ gap: 2 }}>
                    <span>{c.contactName}</span>
                    <span className="help">{c.contactPhone}</span>
                  </span>
                ),
                projects: c.projects.length === 0 ? (
                  <span className="mono-sm" style={{ color: "var(--faint)" }}>No project yet</span>
                ) : (
                  <span className="stack" style={{ gap: 2 }}>
                    {c.projects.map((p) => (
                      <span key={p.id} className="mono-sm">{p.name} · {PHASE_LABEL[p.phase]}</span>
                    ))}
                  </span>
                ),
                added: <span className="mono-sm" style={{ color: "var(--ink)" }}>{dayMonth(c.createdAt)}</span>,
              },
            }))}
          />
        )}
      </div>
    </AdminShell>
  );
}
