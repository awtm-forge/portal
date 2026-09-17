import type { CompanyPrintView, InvoiceClientView } from "@/modules/serializers";
import { formatPhone } from "@/lib/phone";

/**
 * The invoice, printed (PORTAL-SPEC 6.7 and ADR 0007). It takes client and
 * print views only, so internal cost has no way onto the page.
 *
 * Laid out on the brand's own invoice, the PDF Ayush shared on 15 Sep: the
 * wordmark and the title across the top, the number with a dashed underline,
 * a heavy rule, who it is billed to, one line for the work with the stage
 * under it, the sums at the right, the total in the emphasis terracotta, two
 * cards for payment details and notes, and a thank-you with an orange stop.
 * Everything on it comes from the invoice, the company row and the client;
 * nothing is invented to fill a slot the document had.
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
  const stage = invoice.kind === "ADVANCE" ? "Advance, 1 of 2" : invoice.kind === "BALANCE" ? "Balance, 2 of 2" : "Extra, as agreed";
  const stageLine =
    invoice.kind === "ADVANCE" ? "Advance payment, on agreeing" : invoice.kind === "BALANCE" ? "Balance, on signing off the delivery" : "Extra work, agreed separately";
  const note =
    invoice.kind === "ADVANCE"
      ? "This invoice covers the advance. The balance is invoiced separately, when you sign off the delivery."
      : invoice.kind === "BALANCE"
        ? "This invoice covers the balance, now that the delivery is signed off. Nothing further is invoiced for this project."
        : "This invoice covers work agreed separately from the project's two invoices.";
  const contact = [company.email, formatPhone(company.phone)].filter((s) => s && s.trim()).join("  /  ");

  return (
    <article className="inv">
      <header className="inv-top">
        <div className="stack" style={{ gap: 10 }}>
          <Wordmark name={company.name} />
          <div>
            <p className="inv-meta" style={{ whiteSpace: "pre-wrap" }}>{company.address}</p>
            <p className="inv-meta">{contact}</p>
            {hasGst && <p className="inv-meta">GSTIN {company.gstin}</p>}
          </div>
        </div>
        <div>
          <h1 className="inv-title">Invoice</h1>
          <dl className="inv-meta-list">
            <dt>Invoice no</dt>
            <dd className="inv-no">{invoice.number}</dd>
            <dt>Invoice date</dt>
            <dd>{invoice.issuedAt}</dd>
            <dt>Stage</dt>
            <dd>{stage}</dd>
            {invoice.paidAt && (
              <>
                <dt>Paid</dt>
                <dd>{invoice.paidAt}</dd>
              </>
            )}
          </dl>
        </div>
      </header>

      <hr className="inv-rule" />

      <section>
        <p className="inv-label">Billed to</p>
        <p className="inv-client">{client.businessName}</p>
        <p className="inv-meta">{client.contactName}, {client.contactEmail}</p>
      </section>

      <table className="inv-lines">
        <thead>
          <tr>
            <th>Item</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <span className="inv-item">{projectName}</span>
              <span className="inv-stage">{stageLine}</span>
              {invoice.description && <span className="inv-desc">{invoice.description}</span>}
            </td>
            <td className="num">{invoice.amount}</td>
          </tr>
        </tbody>
      </table>

      <div className="inv-sums">
        <div className="row"><span>Subtotal</span><span>{invoice.amount}</span></div>
        <div className="row last"><span>Tax</span><span>{hasGst ? invoice.tax : "Not applicable"}</span></div>
        <div className="inv-total">
          <span className="inv-label">{invoice.status === "PAID" ? "Total, paid" : "Total payable now"}</span>
          <span className="inv-total-amount">{invoice.total}</span>
        </div>
        <p className="inv-words">{invoice.totalInWords}</p>
      </div>

      <div className="inv-cards">
        {hasBank && (
          <section className="inv-card">
            <p className="inv-label">Payment details</p>
            <dl>
              {company.bankAccountName && <><dt>Account name</dt><dd>{company.bankAccountName}</dd></>}
              {company.bankName && <><dt>Bank</dt><dd>{company.bankName}</dd></>}
              {company.bankAccountNumber && <><dt>Account number</dt><dd>{company.bankAccountNumber}</dd></>}
              {company.bankIfsc && <><dt>IFSC</dt><dd>{company.bankIfsc}</dd></>}
              {company.upiId && <><dt>UPI ID</dt><dd>{company.upiId}</dd></>}
            </dl>
          </section>
        )}
        <section className="inv-card">
          <p className="inv-label">Notes</p>
          <p className="strong">{note}</p>
          <p>{hasGst ? `GST is charged on this invoice under GSTIN ${company.gstin}.` : `${company.name} is not registered under GST, so no GST is charged on this invoice.`}</p>
          {invoice.status !== "PAID" && <p>Please share the payment reference once the transfer is made, so we can confirm receipt.</p>}
        </section>
      </div>

      <footer className="inv-foot">
        <p className="inv-thanks">Thank you<b>.</b></p>
        <p className="inv-foot-name">{company.name}</p>
        <p className="inv-meta">{contact}</p>
      </footer>
    </article>
  );
}

/** The name with its last word in the brand orange, the way the wordmark is set everywhere else. */
export function Wordmark({ name }: { name: string }) {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return <p className="wordmark">{name}</p>;
  const last = words.pop();
  return (
    <p className="wordmark">
      {words.join(" ")} <b>{last}</b>
    </p>
  );
}
