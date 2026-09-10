import { ClientShell } from "@/components/portal/ClientShell";
import { InvoiceList } from "@/components/portal/InvoiceList";
import { forProject } from "@/modules/invoices";
import { invoiceToClientView } from "@/modules/serializers";
import { projectScope } from "../scope";

/** Every invoice on the project, each opening its printable page. Q15. */
export default async function InvoicesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { client, project } = await projectScope(token);
  const invoices = (await forProject(project.id)).map(invoiceToClientView);
  const unpaid = invoices.filter((i) => i.status === "ISSUED").length;

  return (
    <ClientShell businessName={client.businessName} nav={{ token, clientId: client.id, current: "invoices" }}>
      <div style={{ padding: "24px 20px 18px" }} className="stack">
        <p className="k">{project.name}</p>
        <h1 className="c-title" style={{ marginTop: 10 }}>{invoices.length === 1 ? "Your invoice" : "Your invoices"}</h1>
        <p className="c-sub" style={{ marginTop: 10 }}>
          {invoices.length === 0
            ? "Nothing yet. The first invoice is the advance, raised when you agree."
            : unpaid === 0
              ? "All paid, thank you. Each one opens as a page you can print or save."
              : `${unpaid} ${unpaid === 1 ? "is" : "are"} still to pay. Each one opens as a page you can print or save.`}
        </p>
      </div>
      {invoices.length > 0 && (
        <div style={{ padding: "0 20px" }}>
          <InvoiceList invoices={invoices} />
        </div>
      )}
    </ClientShell>
  );
}
