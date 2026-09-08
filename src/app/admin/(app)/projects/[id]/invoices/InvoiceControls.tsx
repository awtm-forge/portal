"use client";

import { useActionState } from "react";
import type { InvoiceClientView } from "@/modules/serializers";
import { markPaidAction, raiseOtherAction, type InvoiceState } from "./actions";

export function MarkPaid({ invoice, projectId, today }: { invoice: InvoiceClientView; projectId: string; today: string }) {
  const [state, action, pending] = useActionState<InvoiceState, FormData>(markPaidAction, {});
  const v = state.values ?? {};
  return (
    <details className="stack" style={{ gap: 8, paddingTop: 8 }}>
      <summary className="link-mono" style={{ cursor: "pointer", listStyle: "none" }}>Mark it paid</summary>
      <form action={action} className="stack" style={{ gap: 10, paddingTop: 10 }}>
        <input type="hidden" name="invoiceId" value={invoice.id} />
        <input type="hidden" name="projectId" value={projectId} />
        <div className="grid2">
          <label className="stack" style={{ gap: 6 }}><span className="lbl">The day it landed</span><input className="a-fld" type="date" name="paidOn" defaultValue={v.paidOn ?? today} max={today} required /></label>
          <label className="stack" style={{ gap: 6 }}><span className="lbl">Reference</span><input className="a-fld" name="reference" defaultValue={v.reference} placeholder="NEFT ref" /></label>
          <label className="stack" style={{ gap: 6 }}><span className="lbl">How</span><input className="a-fld" name="method" defaultValue={v.method ?? "Bank transfer"} placeholder="Bank transfer" /></label>
        </div>
        {state.message && <p className="help err">{state.message}</p>}
        <div><button className="a-btn" type="submit" disabled={pending}>{pending ? "Saving" : `Mark ${invoice.number} paid`}</button></div>
      </form>
    </details>
  );
}

/** PORTAL-SPEC 5.1: the only kind that can be raised by hand. */
export function RaiseOther({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<InvoiceState, FormData>(raiseOtherAction, {});
  const v = state.values ?? {};
  return (
    <details className="stack" style={{ gap: 8, borderTop: "1px solid var(--rule-soft)", paddingTop: 12 }}>
      <summary className="link-mono" style={{ cursor: "pointer", listStyle: "none" }}>Raise an extra invoice</summary>
      <form action={action} className="stack" style={{ gap: 10, paddingTop: 10 }}>
        <input type="hidden" name="projectId" value={projectId} />
        <p className="help" style={{ lineHeight: 1.65 }}>
          For something genuinely extra, agreed separately. The advance and the balance are never raised here: they follow a sign-off and nothing else.
        </p>
        <div className="grid2">
          <label className="stack" style={{ gap: 6 }}><span className="lbl">What it is for, as the client will read it</span><input className="a-fld" name="description" defaultValue={v.description} required /></label>
          <label className="stack" style={{ gap: 6 }}><span className="lbl">Amount, in rupees</span><input className="a-fld" name="rupees" defaultValue={v.rupees} inputMode="decimal" required /></label>
        </div>
        {state.message && <p className="help err">{state.message}</p>}
        <div><button className="a-btn ghost" type="submit" disabled={pending}>{pending ? "Raising" : "Raise it"}</button></div>
      </form>
    </details>
  );
}
