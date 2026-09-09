import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/modules/auth/admin";
import { dayMonth } from "@/lib/format";
import { intakeProgress } from "@/modules/intake/progress";
import { listForAdmin } from "@/modules/projects";
import { needsAttention } from "@/modules/projects/attention";
import { NeedsAttention } from "./NeedsAttention";

export default async function ProjectsPage() {
  const admin = await requireAdmin();
  const attention = await needsAttention();
  const projects = await listForAdmin();
  const waiting = projects.filter((p) => !p.client.intake?.submittedAt).length;

  return (
    <AdminShell active="projects" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="a-title">Projects</h1>
        <p className="a-sub">{projects.length} {projects.length === 1 ? "project" : "projects"}. {waiting} waiting on a questionnaire.</p>
      </div>
      <NeedsAttention items={attention} />

      <div className="a-card">
        <div className="between"><span className="k">All projects</span><Link className="a-btn" href="/admin/clients">New project, from a client</Link></div>
        <div className="grid-head" style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 1.6fr 1.2fr 0.7fr", gap: 16, paddingBottom: 8, borderBottom: "1px solid var(--rule)" }}>
          <span className="k">Project</span><span className="k">Client</span><span className="k">Questionnaire</span><span className="k">Signs off</span><span className="k" style={{ textAlign: "right" }}>Created</span>
        </div>
        {projects.length === 0 && <p className="c-sub">No projects yet. The first one starts after a discovery call.</p>}
        {projects.map((p) => {
          let q: { text: string; tone: "ember" | "muted" | "dim" };
          if (!p.client.intake) q = { text: "Not uploaded yet", tone: "dim" };
          else if (p.client.intake.submittedAt) q = { text: `Submitted ${dayMonth(p.client.intake.submittedAt)}`, tone: "muted" };
          else {
            const pr = intakeProgress(p.client.intake.document, p.client.intake.answers, p.client.intake.sectionsDone);
            q = { text: `Open, ${pr.done} of ${pr.total} sections${p.client.intake.lastSavedAt ? `, saved ${dayMonth(p.client.intake.lastSavedAt)}` : ""}`, tone: "ember" };
          }
          return (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 1.6fr 1.2fr 0.7fr", gap: 16, alignItems: "center", padding: "13px 0", borderBottom: "1px solid var(--rule-soft)" }}>
              <Link href={`/admin/projects/${p.id}`} className="sec-name" style={{ fontSize: 14.5, textDecoration: "none" }}>{p.name}</Link>
              <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{p.client.businessName}</span>
              <span className="mono-sm" style={{ color: q.tone === "ember" ? "var(--ember)" : q.tone === "dim" ? "var(--faint)" : "var(--muted)" }}>{q.text}</span>
              <span style={{ fontSize: 13.5, color: "var(--muted)" }}>{p.signoffPersonName}</span>
              <span className="mono-sm" style={{ textAlign: "right", color: "var(--ink)" }}>{dayMonth(p.createdAt)}</span>
            </div>
          );
        })}
      </div>
    </AdminShell>
  );
}
