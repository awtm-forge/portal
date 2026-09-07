import { notFound, redirect } from "next/navigation";
import { AgreementDocument } from "@/components/portal/AgreementDocument";
import { db } from "@/lib/db";
import { currentClientSession, projectByToken } from "@/modules/auth/client";
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
  const byToken = await projectByToken(token);
  const project = byToken ?? (admin ? await db.project.findUnique({ where: { id: token }, include: { client: true } }) : null);
  if (!project) notFound();
  if (!admin && !(await currentClientSession(project.id))) redirect(`/p/${token}`);

  const agreement = await db.agreement.findUnique({ where: { projectId: project.id } });
  if (!agreement?.sentAt) notFound();

  return (
    <div className="c-page" style={{ maxWidth: 720 }}>
      <AgreementDocument
        view={agreementToPrintView(agreement)}
        projectName={project.name}
        businessName={project.client.businessName}
      />
      <p className="help no-print" style={{ padding: "0 20px 24px" }}>Print this page, and choose Save as PDF.</p>
    </div>
  );
}
