import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { dayMonth, isoDate } from "@/lib/dates";
import { requireAdmin } from "@/modules/auth/admin";
import { withClientAndAgreement } from "@/modules/projects";
import { nextWeekNumber, forProject } from "@/modules/updates";
import { UpdateForm } from "./UpdateForm";

export default async function UpdatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const admin = await requireAdmin();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const project = await withClientAndAgreement(id);
  if (!project) notFound();

  const updates = await forProject(id);
  const asked = query.week ? Number(query.week) : null;
  const week = asked && Number.isInteger(asked) ? asked : await nextWeekNumber(id, project.agreement?.startDate ?? null);
  const editing = updates.find((u) => u.weekNumber === week) ?? null;

  return (
    <AdminShell active="projects" adminName={admin.name}>
      <div className="between" style={{ alignItems: "flex-end" }}>
        <div className="stack" style={{ gap: 6 }}>
          <h1 className="a-title">Weekly update</h1>
          <p className="a-sub">
            {project.name} · {project.client.businessName}
            {project.weekCount ? ` · week ${week} of ${project.weekCount}` : ` · week ${week}`}
          </p>
        </div>
        <Link className="a-btn ghost" href={`/admin/projects/${id}`}>Back to the project</Link>
      </div>

      <div className="a-cols">
        <div className="main">
          <UpdateForm
            projectId={id}
            weekNumber={week}
            sent={Boolean(editing?.sentAt)}
            contactName={project.client.contactName}
            contactPhone={project.client.contactPhone}
            weekCount={project.weekCount}
            values={
              editing
                ? {
                    moved: editing.moved,
                    nextUp: editing.nextUp,
                    needFromYou: editing.needFromYou,
                    needByDate: isoDate(editing.needByDate),
                    risks: editing.risks,
                    stagingUrl: editing.stagingUrl ?? "",
                  }
                : null
            }
          />
        </div>

        <div className="aside">
          <div className="a-card">
            <span className="k">Every week so far</span>
            {updates.length === 0 && <p className="c-sub" style={{ fontSize: 14 }}>None yet. The first one goes out in the first week of the build.</p>}
            <div className="stack">
              {updates.map((u) => (
                <div className="between" key={u.id} style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}>
                  <Link className="mono-sm" href={`/admin/projects/${id}/updates?week=${u.weekNumber}`} style={{ color: u.weekNumber === week ? "var(--ember)" : "var(--muted)" }}>
                    Week {u.weekNumber}
                  </Link>
                  <span className="help">{u.sentAt ? `sent ${dayMonth(u.sentAt)}` : "draft"}</span>
                </div>
              ))}
            </div>
            <p className="help" style={{ lineHeight: 1.65 }}>
              A draft is yours. Once sent, a client has read it, so it cannot be changed: write the next week instead.
            </p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
