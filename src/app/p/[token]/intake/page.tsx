import { notFound, redirect } from "next/navigation";
import { IntakeRenderer } from "@/components/intake/IntakeRenderer";
import { ClientShell } from "@/components/portal/ClientShell";
import { currentClientSession, projectByToken } from "@/modules/auth/client";
import { db } from "@/lib/db";
import { readAnswers, readBoolMap, readStringList } from "@/modules/intake/answers";
import { parseDocumentLoose } from "@/modules/intake/document";
import { fileInfoMap } from "@/modules/intake/load";

export default async function IntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const project = await projectByToken(token);
  if (!project) notFound();
  if (!(await currentClientSession(project.id))) redirect(`/p/${token}`);
  const intake = await db.intake.findUnique({ where: { projectId: project.id } });
  if (!intake) redirect(`/p/${token}`);
  const doc = parseDocumentLoose(intake.document);
  if (!doc) redirect(`/p/${token}`);
  const files = await fileInfoMap(project.id);
  const base = `/p/${token}`;
  return (
    <ClientShell businessName={project.client.businessName}>
      <IntakeRenderer
        doc={doc}
        initialAnswers={readAnswers(intake.answers)}
        initialAccess={readBoolMap(intake.accessGranted)}
        initialDone={readStringList(intake.sectionsDone)}
        initialFiles={files}
        submittedAt={intake.submittedAt ? intake.submittedAt.toISOString() : null}
        apiBase={`${base}/intake/api`}
        fileBase={`${base}/file`}
        libBase={`${base}/lib`}
        mode="client"
        prefill={{ name: project.client.signoffPersonName, email: project.client.signoffPersonEmail }}
        kickoffDateText="the kickoff date"
        contactFirstName={project.client.contactName.split(" ")[0] ?? ""}
      />
    </ClientShell>
  );
}
