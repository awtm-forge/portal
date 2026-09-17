import { notFound, redirect } from "next/navigation";
import { AgreementDocument } from "@/components/portal/AgreementDocument";
import { Wordmark } from "@/components/portal/InvoiceDocument";
import { company } from "@/modules/settings";
import { PrintButton } from "@/components/portal/PrintButton";
import { db } from "@/lib/db";
import { clientByToken, currentClientSession } from "@/modules/auth/client";
import { activeProjectFor } from "@/modules/clients";
import { currentAdmin } from "@/modules/auth/admin";
import { agreementToPrintView } from "@/modules/serializers";
import "@/components/portal/portal.css";
import { formatPhone } from "@/lib/phone";

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
  const view = agreementToPrintView(agreement);
  const c = await company();
  const contact = [c.email, formatPhone(c.phone)].filter((s) => s && s.trim()).join("  /  ");

  // The same head as the invoice, on the same paper (15 Sep): the wordmark,
  // the title, and what this document is, before the agreement itself.
  return (
    <main className="paper">
      <div className="c-page">
        <div className="inv">
          <header className="inv-top">
            <div className="stack" style={{ gap: 10 }}>
              <Wordmark name={c.name} />
              <div>
                <p className="inv-meta" style={{ whiteSpace: "pre-wrap" }}>{c.address}</p>
                <p className="inv-meta">{contact}</p>
              </div>
            </div>
            <div>
              <h1 className="inv-title">Agreement</h1>
              <dl className="inv-meta-list">
                <dt>Project</dt>
                <dd>{project.name}</dd>
                <dt>For</dt>
                <dd>{project.client.businessName}</dd>
                <dt>Version</dt>
                <dd>{view.version}</dd>
                {view.isAgreed && (
                  <>
                    <dt>Agreed</dt>
                    <dd>{view.agreedAt}</dd>
                  </>
                )}
              </dl>
            </div>
          </header>
          <hr className="inv-rule" />
          <AgreementDocument view={view} projectName={project.name} businessName={project.client.businessName} />
          <footer className="inv-foot">
            <p className="inv-thanks">Thank you<b>.</b></p>
            <p className="inv-foot-name">{c.name}</p>
            <p className="inv-meta">{contact}</p>
          </footer>
        </div>
        <PrintButton />
        <p className="help no-print" style={{ padding: "12px 0 24px" }}>In the print dialog, choose Save as PDF to keep a copy.</p>
      </div>
    </main>
  );
}
