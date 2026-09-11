import { notFound, redirect } from "next/navigation";
import { AgreementDocument } from "@/components/portal/AgreementDocument";
import { PrintButton } from "@/components/portal/PrintButton";
import { db } from "@/lib/db";
import { clientByToken, currentClientSession } from "@/modules/auth/client";
import { activeProjectFor } from "@/modules/clients";
import { currentAdmin } from "@/modules/auth/admin";
import { agreementToPrintView } from "@/modules/serializers";
import "@/components/portal/portal.css";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/**
 * PORTAL-SPEC 6.7 and QUESTIONS.md Q3: the holder of a project's link can
 * print that project's agreement, and admin can print any. The print view is
 * the client view, so internal cost cannot appear here (ADR 0009).
 */
export default async function AgreementPrintPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = await currentAdmin();

  // The path segment is a client link token. Admin, who never holds a token
  // because only its hash is stored, may pass a project id instead.
  const client = await clientByToken(token);
  const byToken = client ? await activeProjectFor(client.id) : null;
  const project = byToken
    ? { ...byToken, client }
    : admin
      ? await db.project.findUnique({ where: { id: token }, include: { client: true } })
      : null;
  if (!project || !project.client) notFound();
  if (!admin && !(await currentClientSession(project.client.id))) redirect(`/p/${token}`);

  const agreement = await db.agreement.findUnique({ where: { projectId: project.id } });
  if (!agreement?.sentAt) notFound();

  return (
    <div className="c-page" style={{ maxWidth: 720 }}>
      <AgreementDocument
        view={agreementToPrintView(agreement)}
        projectName={project.name}
        businessName={project.client.businessName}
      />
      <PrintButton />
      <p className="help no-print" style={{ padding: "12px 20px 24px" }}>In the print dialog, choose Save as PDF to keep a copy.</p>
    </div>
  );
}
