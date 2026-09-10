import Link from "next/link";
import { redirect } from "next/navigation";
import { AgreementDocument } from "@/components/portal/AgreementDocument";
import { ClientShell } from "@/components/portal/ClientShell";
import { Phase } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { projectScope } from "../scope";
import { agreementToClientView } from "@/modules/serializers";
import { AgreeControls } from "./AgreeControls";

export default async function ClientAgreementPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { client, project } = await projectScope(token);

  const agreement = await db.agreement.findUnique({ where: { projectId: project.id } });
  // Nothing to read until it has been sent at least once.
  if (!agreement?.sentAt) redirect(`/p/${token}`);
  const view = agreementToClientView(agreement);
  const open = project.phase === Phase.AGREEMENT_SENT;

  return (
    <ClientShell businessName={client.businessName} nav={{ token, clientId: client.id, current: "agreement" }}>
      <AgreementDocument view={view} projectName={project.name} businessName={client.businessName} />

      {open && <AgreeControls token={token} signoffPersonName={project.signoffPersonName} />}

      {!open && !view.isAgreed && (
        <div className="card" style={{ margin: "0 20px", padding: "18px 16px" }}>
          <div className="stack" style={{ gap: 10 }}>
            <span className="sec-name" style={{ fontSize: 17 }}>We are changing it</span>
            <p className="c-sub">You told us something was off. The next version appears here when it is ready.</p>
          </div>
        </div>
      )}

      <div style={{ padding: "22px 20px 0" }} className="no-print">
        <Link className="btn-full ghost" href={`/agreement/${token}/print`}>Save it as a PDF</Link>
      </div>
    </ClientShell>
  );
}
