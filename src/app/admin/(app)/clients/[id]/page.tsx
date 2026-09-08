import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { db } from "@/lib/db";
import { dayMonth } from "@/lib/dates";
import { requireAdmin } from "@/modules/auth/admin";
import { PHASE_LABEL } from "@/modules/projects/phase";
import { updateClientAction } from "../../actions";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const client = await db.client.findUnique({
    where: { id },
    include: { projects: { orderBy: { createdAt: "desc" } } },
  });
  if (!client) notFound();

  return (
    <AdminShell active="clients" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="a-title">{client.businessName}</h1>
        <p className="a-sub">Added {dayMonth(client.createdAt)}{client.location ? ` · ${client.location}` : ""}</p>
      </div>

      <div className="a-cols">
        <div className="main">
          {client.projects.length === 0 ? (
            <div className="a-card ember">
              <span className="k ember">No project yet</span>
              <p className="c-sub" style={{ fontSize: 14 }}>A client with no project has nothing to open. Start one and they get their link.</p>
              <div><Link className="a-btn" href={`/admin/clients/${client.id}/projects/new`}>Start a project</Link></div>
            </div>
          ) : (
            <div className="a-card">
              <div className="between"><span className="k">Projects</span><Link className="a-btn" href={`/admin/clients/${client.id}/projects/new`}>Start another</Link></div>
              <div className="stack">
                {client.projects.map((p) => (
                  <div key={p.id} className="between" style={{ padding: "11px 0", borderBottom: "1px solid var(--rule-soft)" }}>
                    <span className="stack" style={{ gap: 3 }}>
                      <Link href={`/admin/projects/${p.id}`} className="sec-name" style={{ fontSize: 14.5, textDecoration: "none" }}>{p.name}</Link>
                      <span className="help">{PHASE_LABEL[p.phase]} · signs off {p.signoffPersonName}</span>
                    </span>
                    <span className="mono-sm" style={{ color: p.linkEmailedAt ? "var(--muted)" : "var(--ember)" }}>
                      {p.linkEmailedAt ? `link sent ${dayMonth(p.linkEmailedAt)}` : "link not sent"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="a-card">
            <span className="k">Details</span>
            <form action={updateClientAction} className="stack" style={{ gap: 14 }}>
              <input type="hidden" name="clientId" value={client.id} />
              <div className="grid2">
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Business name</span><input className="a-fld" name="businessName" defaultValue={client.businessName} required /></label>
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Where they are</span><input className="a-fld" name="location" defaultValue={client.location ?? ""} /></label>
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Contact name</span><input className="a-fld" name="contactName" defaultValue={client.contactName} required /></label>
                <label className="stack" style={{ gap: 6 }}><span className="lbl">WhatsApp number</span><input className="a-fld" name="contactPhone" defaultValue={client.contactPhone} required /></label>
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Contact email</span><input className="a-fld" name="contactEmail" type="email" defaultValue={client.contactEmail} required /></label>
              </div>
              <div><button className="a-btn ghost" type="submit">Save changes</button></div>
            </form>
          </div>
        </div>

        <div className="aside">
          <div className="a-card">
            <span className="k">Who says yes</span>
            <p className="c-sub" style={{ fontSize: 14 }}>Asked and answered per project, so a brand job and a store rebuild can have different approvers.</p>
            <div className="stack">
              {client.projects.map((p) => (
                <div key={p.id} className="row">
                  <span className="lbl">{p.name}</span>
                  <p style={{ margin: 0, fontSize: 14 }}>{p.signoffPersonName}</p>
                  <p className="mono-sm" style={{ margin: 0 }}>{p.signoffPersonEmail}</p>
                </div>
              ))}
              {client.projects.length === 0 && <p className="help">Nothing to show until there is a project.</p>}
            </div>
          </div>
          <div className="a-card">
            <span className="k">How they get in</span>
            <p className="help" style={{ lineHeight: 1.9 }}>
              One link per project, which does not expire.<br />
              A six digit code the first time on each phone or laptop.<br />
              Thirty days signed in on that device.<br />
              A fresh code for each sign-off, however recent the last one.
            </p>
            <p className="help" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 12, lineHeight: 1.65 }}>
              No password exists. If they ask you for one, the answer is that there is not one and there never was.
            </p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
