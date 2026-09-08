import type { CompanyPrintView, InvoiceClientView } from "@/modules/serializers";

/**
 * The invoice, printed (PORTAL-SPEC 6.7 and ADR 0007). It takes client and
 * print views only, so internal cost has no way onto the page.
 *
 * The GST block appears only once a GSTIN exists, per PORTAL-SPEC 5.8:
 * registering later is a settings change, not a rebuild.
 */
export function InvoiceDocument({
  invoice,
  company,
  client,
  projectName,
}: {
  invoice: InvoiceClientView;
  company: CompanyPrintView;
  client: { businessName: string; contactName: string; contactEmail: string };
  projectName: string;
}) {
  const hasGst = company.gstin !== null && company.gstin.trim() !== "";
  const hasBank = Boolean(company.bankAccountNumber || company.upiId);

  return (
    <article className="doc invoice">
      <header className="inv-head">
        <div className="stack" style={{ gap: 4 }}>
          <span className="inv-name">{company.name}</span>
          <p className="help" style={{ whiteSpace: "pre-wrap" }}>{company.address}</p>
          <p className="help">{company.email}{company.phone ? ` · ${company.phone}` : ""}</p>
          {hasGst && <p className="help">GSTIN {company.gstin}</p>}
        </div>
        <div className="stack" style={{ gap: 4, textAlign: "right" }}>
          <span className="k">Invoice</span>
          <span className="inv-number">{invoice.number}</span>
          <p className="help">{invoice.issuedAt}</p>
          <p className="help">{invoice.statusLabel}{invoice.paidAt ? ` ${invoice.paidAt}` : ""}</p>
        </div>
      </header>

      <section className="doc-sec">
        <h2>Billed to</h2>
        <div className="stack" style={{ gap: 3 }}>
          <p style={{ color: "var(--ink)" }}>{client.businessName}</p>
          <p className="help">{client.contactName}</p>
          <p className="help">{client.contactEmail}</p>
        </div>
      </section>

      <section className="doc-sec">
        <h2>For</h2>
        <table className="inv-table">
          <tbody>
            <tr>
              <td>
                <span style={{ color: "var(--ink)" }}>{projectName}</span>
                <span className="d-check" style={{ display: "block" }}>{invoice.description}</span>
              </td>
              <td className="num">{invoice.amount}</td>
            </tr>
            {hasGst && (
              <tr>
                <td>Tax</td>
                <td className="num">{invoice.tax}</td>
              </tr>
            )}
            <tr className="total">
              <td>Total</td>
              <td className="num">{invoice.total}</td>
            </tr>
          </tbody>
        </table>
        <p className="help" style={{ marginTop: 10 }}>{invoice.totalInWords}</p>
      </section>

      {hasBank && (
        <section className="doc-sec">
          <h2>How to pay</h2>
          <dl className="pairs">
            {company.bankAccountName && <><dt>Account name</dt><dd>{company.bankAccountName}</dd></>}
            {company.bankName && <><dt>Bank</dt><dd>{company.bankName}</dd></>}
            {company.bankAccountNumber && <><dt>Account number</dt><dd>{company.bankAccountNumber}</dd></>}
            {company.bankIfsc && <><dt>IFSC</dt><dd>{company.bankIfsc}</dd></>}
            {company.upiId && <><dt>UPI</dt><dd>{company.upiId}</dd></>}
          </dl>
          <p className="help">Bank transfer. Send the reference and we will mark it paid.</p>
        </section>
      )}

      {!hasGst && <p className="help">No tax is charged on this invoice.</p>}
    </article>
  );
}
