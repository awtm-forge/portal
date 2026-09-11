import type { AgreementClientView } from "@/modules/serializers";
import { dayMonthYear, fromIsoDate } from "@/lib/dates";

/**
 * The agreement as the client reads it (PORTAL-SPEC 6.3). The same component
 * renders the print route (ADR 0007), so the two cannot drift.
 *
 * It takes a client view, never a model, so internal cost has no way in.
 */
export function AgreementDocument({ view, projectName, businessName }: { view: AgreementClientView; projectName: string; businessName: string }) {
  return (
    <article className="doc">
      <header className="doc-head">
        <div className="stack" style={{ gap: 6 }}>
          <p className="k">What we agreed</p>
          <h1 className="c-title">{projectName}</h1>
          <p className="c-sub">for {businessName}</p>
          {view.isAgreed && <p className="doc-stamp-line">Agreed by {view.agreedByName} on {view.agreedAt}</p>}
        </div>
      </header>

      <section className="doc-sec">
        <h2>What we are building</h2>
        <p style={{ whiteSpace: "pre-wrap" }}>{view.scope}</p>
      </section>

      <section className="doc-sec">
        <h2>What you get, and how you check it</h2>
        <ul className="deliverables">
          {view.deliverables.map((d) => (
            <li key={d.key}>
              <span className="d-text">{d.text}</span>
              {d.how_to_check && <span className="d-check">How you check it: {d.how_to_check}</span>}
            </li>
          ))}
        </ul>
      </section>

      {view.notIncluded && (
        <section className="doc-sec">
          <h2>What is not included</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{view.notIncluded}</p>
        </section>
      )}

      <section className="doc-sec">
        <h2>Dates</h2>
        <dl className="pairs">
          {view.startDate && <div className="pair"><dt>Start</dt><dd>{view.startDate}</dd></div>}
          {view.launchTargetDate && <div className="pair"><dt>Launch target</dt><dd>{view.launchTargetDate}</dd></div>}
          {view.milestones.map((m) => (
            <div className="pair" key={`${m.label}-${m.date}`}><dt>{m.label}</dt><dd>{prettyDate(m.date)}</dd></div>
          ))}
        </dl>
        <p className="help">Dates, not sign-offs. The only thing you sign off is the delivery.</p>
      </section>

      <section className="doc-sec">
        <h2>The price</h2>
        <dl className="pairs">
          <div className="pair"><dt>Total, fixed</dt><dd>{view.total}</dd></div>
          <div className="pair"><dt>Advance, on agreeing</dt><dd>{view.advance}</dd></div>
          <div className="pair"><dt>Balance, when you sign off the delivery</dt><dd>{view.balance}</dd></div>
        </dl>
        <p className="help">Two invoices, and only two. Nothing is invoiced for work you have not accepted.</p>
      </section>

      {view.howWeWork && (
        <section className="doc-sec">
          <h2>How we work</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{view.howWeWork}</p>
        </section>
      )}

      {view.ifWeMiss && (
        <section className="doc-sec">
          <h2>If we miss a date</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{view.ifWeMiss}</p>
        </section>
      )}

      {view.afterDeliveryOffer && (
        <section className="doc-sec">
          <h2>After delivery</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{view.afterDeliveryOffer}</p>
        </section>
      )}

      {view.isAgreed && (
        <section className="doc-sec stamp">
          <h2>Agreed</h2>
          <p>
            Agreed by {view.agreedByName} on {view.agreedAt}
            {view.agreedMethod === "WHATSAPP" ? ", recorded from WhatsApp" : ""}. Version {view.version}.
          </p>
        </section>
      )}
    </article>
  );
}

/** A milestone is stored as an ISO day; the page says it the way the other dates are said. */
function prettyDate(iso: string): string {
  const d = fromIsoDate(iso);
  return d ? dayMonthYear(d) : iso;
}

