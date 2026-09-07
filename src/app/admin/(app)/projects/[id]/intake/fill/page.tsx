import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { IntakeRenderer } from "@/components/intake/IntakeRenderer";
import { requireAdmin } from "@/modules/auth/admin";
import { db } from "@/lib/db";
import { readAnswers, readBoolMap, readStringList } from "@/lib/intake/answers";
import { parseDocumentLoose } from "@/lib/intake/document";
import { fileInfoMap } from "@/lib/intake/load";

export default async function FillPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id }, include: { client: true, intake: true } });
  if (!project) notFound();
  if (!project.intake) redirect(`/admin/projects/${id}`);
  const doc = parseDocumentLoose(project.intake.document);
  if (!doc) redirect(`/admin/projects/${id}`);
  const files = await fileInfoMap(project.id);
  return (
    <AdminShell active="projects" adminName={admin.name}>
      <div className="between">
        <div className="stack" style={{ gap: 6 }}>
          <h1 className="a-title">Type their answers</h1>
          <p className="a-sub">{project.client.businessName} · what they said on the call, in their words · marked as taken on a call</p>
        </div>
        <Link className="a-btn ghost" href={`/admin/projects/${id}/intake`}>Back to what they told us</Link>
      </div>
      <div style={{ maxWidth: 480, border: "1px solid var(--rule)", borderRadius: 2, background: "var(--ground)" }}>
        <IntakeRenderer
          doc={doc}
          initialAnswers={readAnswers(project.intake.answers)}
          initialAccess={readBoolMap(project.intake.accessGranted)}
          initialDone={readStringList(project.intake.sectionsDone)}
          initialFiles={files}
          submittedAt={project.intake.submittedAt ? project.intake.submittedAt.toISOString() : null}
          apiBase={`/admin/projects/${id}/intake/api`}
          fileBase={`/admin/projects/${id}/file`}
          libBase="/admin/lib"
          mode="team"
          prefill={{ name: project.client.signoffPersonName, email: project.client.signoffPersonEmail }}
          kickoffDateText="the kickoff date"
          contactFirstName={project.client.contactName.split(" ")[0] ?? ""}
        />
      </div>
    </AdminShell>
  );
}
