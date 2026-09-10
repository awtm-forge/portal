import { redirect } from "next/navigation";
import { IntakeRenderer } from "@/components/intake/IntakeRenderer";
import { ClientShell } from "@/components/portal/ClientShell";
import { readAnswers, readBoolMap, readStringList } from "@/modules/intake/answers";
import { parseDocumentLoose } from "@/modules/intake/document";
import { fileInfoMap } from "@/modules/intake/load";
import { requestsFor, stateOf } from "@/modules/intake/changes";
import { versionsFor } from "@/modules/intake/versions";
import { intakeStateToClientView } from "@/modules/serializers";
import { withIntake } from "@/modules/clients";
import { clientScope } from "../scope";

export default async function IntakePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const who = await clientScope(token);
  const client = await withIntake(who.id);
  const intake = client?.intake;
  if (!client || !intake) redirect(`/p/${token}`);
  const doc = parseDocumentLoose(intake.document);
  if (!doc) redirect(`/p/${token}`);
  const [files, requests, versions] = await Promise.all([fileInfoMap(client.id), requestsFor(client.id), versionsFor(client.id)]);
  const base = `/p/${token}`;
  return (
    <ClientShell businessName={client.businessName} nav={{ token, clientId: client.id, current: "questionnaire" }} wide>
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
        prefill={{ name: client.proposedSignoffName ?? client.contactName, email: client.proposedSignoffEmail ?? client.contactEmail }}
        kickoffDateText="the kickoff date"
        contactFirstName={client.contactName.split(" ")[0] ?? ""}
        state={intakeStateToClientView(stateOf(intake, requests))}
        lastSentAt={versions.at(-1)?.sentAt.toISOString() ?? null}
      />
    </ClientShell>
  );
}
