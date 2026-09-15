import { notFound } from "next/navigation";
import { InvoiceDocument } from "@/components/portal/InvoiceDocument";
import { PrintButton } from "@/components/portal/PrintButton";
import { currentAdmin } from "@/modules/auth/admin";
import { currentClientSession } from "@/modules/auth/client";
import { forPrint } from "@/modules/invoices";
import { companyToPrintView, invoiceToPrintView } from "@/modules/serializers";
import { company } from "@/modules/settings";
import "@/components/portal/portal.css";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

/**
 * PORTAL-SPEC 6.7. Reachable by an admin, or by the client whose project it
 * belongs to: they should be able to save their own invoice without asking.
 * The print view has no field for internal cost (ADR 0009).
 */
export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await forPrint(id);
  if (!invoice) notFound();

  const admin = await currentAdmin();
  if (!admin && !(await currentClientSession(invoice.project.clientId))) notFound();

  const c = await company();

  return (
    <main className="paper">
      <div className="c-page">
      <InvoiceDocument
        invoice={invoiceToPrintView(invoice)}
        company={companyToPrintView(c)}
        client={{
          businessName: invoice.project.client.businessName,
          contactName: invoice.project.client.contactName,
          contactEmail: invoice.project.client.contactEmail,
        }}
        projectName={invoice.project.name}
      />
      <PrintButton />
      <p className="help no-print" style={{ padding: "12px 0 24px" }}>In the print dialog, choose Save as PDF to keep a copy.</p>
      </div>
    </main>
  );
}
