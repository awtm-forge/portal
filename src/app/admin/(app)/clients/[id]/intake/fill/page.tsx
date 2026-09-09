import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { IntakeRenderer } from "@/components/intake/IntakeRenderer";
import { requireAdmin } from "@/modules/auth/admin";
import { withIntake } from "@/modules/clients";
import { readAnswers, readBoolMap, readStringList } from "@/modules/intake/answers";
import { parseDocumentLoose } from "@/modules/intake/document";
import { fileInfoMap } from "@/modules/intake/load";

export default async function FillPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const client = await withIntake(id);
  if (!client) notFound();
  if (!client.intake) redirect(`/admin/clients/${id}`);
  const doc = parseDocumentLoose(client.intake.document);
  if (!doc) redirect(`/admin/clients/${id}`);
  const files = await fileInfoMap(client.id);
  return (
    <AdminShell active="clients" adminName={admin.name}>
      <div className="between">
        <div className="stack" style={{ gap: 6 }}>
          <h1 className="a-title">Type their answers</h1>
          <p className="a-sub">{client.businessName} · what they said on the call, in their words · marked as taken on a call</p>
        </div>
        <Link className="a-btn ghost" href={`/admin/clients/${id}/intake`}>Back to what they told us</Link>
      </div>
      <div style={{ maxWidth: 480, border: "1px solid var(--rule)", borderRadius: 2, background: "var(--ground)" }}>
        <IntakeRenderer
          doc={doc}
          initialAnswers={readAnswers(client.intake.answers)}
          initialAccess={readBoolMap(client.intake.accessGranted)}
          initialDone={readStringList(client.intake.sectionsDone)}
          initialFiles={files}
          submittedAt={client.intake.submittedAt ? client.intake.submittedAt.toISOString() : null}
          apiBase={`/admin/clients/${id}/intake/api`}
          fileBase={`/admin/clients/${id}/file`}
          libBase="/admin/lib"
          mode="team"
          prefill={{ name: client.proposedSignoffName ?? client.contactName, email: client.proposedSignoffEmail ?? client.contactEmail }}
          kickoffDateText="the kickoff date"
          contactFirstName={client.contactName.split(" ")[0] ?? ""}
        />
      </div>
    </AdminShell>
  );
}
