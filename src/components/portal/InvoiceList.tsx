import type { InvoiceClientView } from "@/modules/serializers";

/** Each invoice is one row, and the whole row opens it: nothing to aim at. */
export function InvoiceList({ invoices }: { invoices: InvoiceClientView[] }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      {invoices.map((i) => (
        <a key={i.id} className="inv-row" href={`/invoice/${i.id}/print`} target="_blank" rel="noopener">
          <span className="stack" style={{ gap: 3 }}>
            <span className="mono-sm" style={{ color: "var(--ink)", fontSize: 12 }}>{i.number}</span>
            <span className="help">{i.kindLabel} · {i.issuedAt}</span>
            {i.kind === "OTHER" && <span className="help" style={{ color: "var(--ink)" }}>{i.description}</span>}
          </span>
          <span className="stack" style={{ gap: 3, alignItems: "flex-end", flex: "none" }}>
            <span className="mono-sm" style={{ color: "var(--ink)", fontSize: 13 }}>{i.total}</span>
            <span className="tag" style={{ color: i.status === "PAID" ? "var(--muted)" : "var(--ember)" }}>{i.statusLabel} · open ↗</span>
          </span>
        </a>
      ))}
    </div>
  );
}
