import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { DataList } from "@/components/ui/DataList";
import { Empty } from "@/components/ui/Empty";
import { requireAdmin } from "@/modules/auth/admin";
import { dayMonth } from "@/lib/format";
import { intakeProgress } from "@/modules/intake/progress";
import { listForAdmin } from "@/modules/projects";
import { needsAttention } from "@/modules/projects/attention";
import { PHASE_LABEL } from "@/modules/projects/phase";
import { WAITING_LABEL, waitingOn } from "@/modules/projects/waiting";
import { NeedsAttention } from "./NeedsAttention";

/**
 * The team's first page: what needs attention, then every project with its
 * stage and who it is waiting on, since when (F-20). One table on a laptop,
 * a stack of cards on a phone.
 */
export default async function ProjectsPage() {
  const admin = await requireAdmin();
  const attention = await needsAttention();
  const projects = await listForAdmin();
  const onClient = projects.filter((p) => waitingFor(p).on === "client").length;

  return (
    <AdminShell active="projects" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="a-title">Projects</h1>
        <p className="a-sub">{projects.length} {projects.length === 1 ? "project" : "projects"}. {onClient} waiting on a client.</p>
      </div>
      <NeedsAttention items={attention} />

      <div className="a-card">
        <div className="between"><span className="k">All projects</span><Link className="a-btn" href="/admin/clients">New project, from a client</Link></div>
        {projects.length === 0 ? (
          <Empty title="No projects yet" line="The first one starts after a discovery call: add the client, send the questionnaire, then start the project." action={<Link className="a-btn" href="/admin/clients/new">Add a client</Link>} />
        ) : (
          <DataList
            caption="All projects"
            columns={[
              { key: "project", label: "Project" },
              { key: "stage", label: "Stage" },
              { key: "waiting", label: "Waiting on" },
              { key: "questionnaire", label: "Questionnaire" },
              { key: "signs", label: "Signs off" },
              { key: "created", label: "Created", num: true },
            ]}
            rows={projects.map((p) => {
              const w = waitingFor(p);
              let q: { text: string; tone: "ember" | "muted" | "dim" };
              if (!p.client.intake) q = { text: "Not uploaded yet", tone: "dim" };
              else if (p.client.intake.submittedAt) q = { text: `Submitted ${dayMonth(p.client.intake.submittedAt)}`, tone: "muted" };
              else {
                const pr = intakeProgress(p.client.intake.document, p.client.intake.answers, p.client.intake.sectionsDone);
                q = { text: `Open, ${pr.done} of ${pr.total} sections${p.client.intake.lastSavedAt ? `, saved ${dayMonth(p.client.intake.lastSavedAt)}` : ""}`, tone: "ember" };
              }
              return {
                key: p.id,
                href: `/admin/projects/${p.id}`,
                cells: {
                  project: (
                    <>
                      {p.name}
                      <span className="mono-sm">{p.client.businessName}</span>
                    </>
                  ),
                  stage: PHASE_LABEL[p.phase],
                  waiting: (
                    <span className="stack" style={{ gap: 2 }}>
                      <span style={{ color: w.on === "client" ? "var(--ember)" : w.on === "us" ? "var(--ink)" : "var(--faint)" }}>{WAITING_LABEL[w.on][0].toUpperCase() + WAITING_LABEL[w.on].slice(1)}{w.on === "nobody" ? "" : `, ${w.what}`}</span>
                      {w.since && w.on !== "nobody" && <span className="help">since {dayMonth(w.since)}</span>}
                    </span>
                  ),
                  questionnaire: <span className="mono-sm" style={{ color: q.tone === "ember" ? "var(--ember)" : q.tone === "dim" ? "var(--faint)" : "var(--muted)" }}>{q.text}</span>,
                  signs: p.signoffPersonName,
                  created: <span className="mono-sm" style={{ color: "var(--ink)" }}>{dayMonth(p.createdAt)}</span>,
                },
              };
            })}
          />
        )}
      </div>
    </AdminShell>
  );
}

type Row = Awaited<ReturnType<typeof listForAdmin>>[number];

function waitingFor(p: Row) {
  return waitingOn({
    phase: p.phase,
    createdAt: p.createdAt,
    intakeUploadedAt: p.client.intake?.documentUploadedAt ?? null,
    intakeSubmittedAt: p.client.intake?.submittedAt ?? null,
    agreementSentAt: p.agreement?.sentAt ?? null,
    agreementAgreedAt: p.agreement?.agreedAt ?? null,
    kickoffAt: p.kickoffAt,
    lastUpdateSentAt: p.updates[0]?.sentAt ?? null,
    openRoundSentAt: p.reviewRounds[0]?.sentAt ?? null,
    deliveredAt: p.deliveredAt,
    day30UnlocksAt: p.day30?.unlocksAt ?? null,
    day30AnsweredAt: p.day30?.metricAfterSubmittedAt ?? null,
  });
}
