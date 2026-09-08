import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { db } from "@/lib/db";
import { dayMonth } from "@/lib/dates";
import { requireAdmin } from "@/modules/auth/admin";

export default async function ClientsPage() {
  const admin = await requireAdmin();
  const clients = await db.client.findMany({
    orderBy: { createdAt: "desc" },
    include: { projects: { orderBy: { createdAt: "desc" } } },
  });
  const waiting = clients.filter((c) => c.projects.some((p) => !p.linkEmailedAt)).length;

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
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.2fr 1.6fr 0.8fr", gap: 16, paddingBottom: 8, borderBottom: "1px solid var(--rule)" }}>
          <span className="k">Business</span><span className="k">Who we talk to</span><span className="k">Projects</span><span className="k" style={{ textAlign: "right" }}>Added</span>
        </div>
        {clients.length === 0 && <p className="c-sub" style={{ fontSize: 14 }}>None yet. The first one is added straight after a discovery call.</p>}
        {clients.map((c) => (
          <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1.2fr 1.6fr 0.8fr", gap: 16, alignItems: "center", padding: "13px 0", borderBottom: "1px solid var(--rule-soft)" }}>
            <Link href={`/admin/clients/${c.id}`} className="sec-name" style={{ fontSize: 14.5, textDecoration: "none" }}>{c.businessName}</Link>
            <span className="stack" style={{ gap: 2 }}>
              <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{c.contactName}</span>
              <span className="help">{c.contactPhone}</span>
            </span>
            <span className="stack" style={{ gap: 2 }}>
              {c.projects.length === 0 ? (
                <span className="mono-sm" style={{ color: "var(--faint)" }}>No project yet</span>
              ) : (
                c.projects.map((p) => (
                  <Link key={p.id} href={`/admin/projects/${p.id}`} className="mono-sm" style={{ color: "var(--muted)" }}>
                    {p.name}
                    {!p.linkEmailedAt && <span style={{ color: "var(--ember)" }}> · link not sent</span>}
                  </Link>
                ))
              )}
            </span>
            <span className="mono-sm" style={{ textAlign: "right", color: "var(--ink)" }}>{dayMonth(c.createdAt)}</span>
          </div>
        ))}
        <p className="help" style={{ lineHeight: 1.65 }}>
          A client can exist before a project does, so you can take the details on the call and write the questionnaire afterwards. The link belongs to a project, not to the client, which is why a client with no project has none.
        </p>
      </div>
    </AdminShell>
  );
}
