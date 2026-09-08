"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createClientAction, type ClientFormState } from "../actions";

/** Adding a client. It sends nothing and makes no password, because there is none. */
export function ClientForm() {
  const [state, action, pending] = useActionState<ClientFormState, FormData>(createClientAction, {});
  const v = state.values ?? {};
  return (
    <form action={action} className="a-cols">
      <div className="main">
        <div className="a-card">
          <span className="k">The business</span>
          <div className="grid2">
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Business name</span><input className="a-fld" name="businessName" defaultValue={v.businessName} required autoFocus /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Where they are, optional</span><input className="a-fld" name="location" defaultValue={v.location} placeholder="Pune" /></label>
          </div>
        </div>
        <div className="a-card">
          <span className="k">Who we talk to day to day</span>
          <div className="grid2">
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Name</span><input className="a-fld" name="contactName" defaultValue={v.contactName} required /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">WhatsApp number, with country code</span><input className="a-fld" name="contactPhone" defaultValue={v.contactPhone} placeholder="+91 99000 21188" required /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Email</span><input className="a-fld" name="contactEmail" type="email" defaultValue={v.contactEmail} required /></label>
          </div>
        </div>
        {state.message && <p className="help err">{state.message}</p>}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="a-btn" type="submit" name="intent" value="start_project" disabled={pending}>{pending ? "Saving" : "Save, and start a project"}</button>
          <button className="a-btn ghost" type="submit" name="intent" value="save" disabled={pending}>Just save the client</button>
          <Link className="a-btn ghost" href="/admin/clients">Cancel</Link>
        </div>
      </div>
      <div className="aside">
        <div className="a-card">
          <span className="k">What this screen does not do</span>
          <p className="c-sub" style={{ fontSize: 14 }}>It sends nothing, and it makes no password. There is no password anywhere in this system for a client to have.</p>
          <p className="help" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 12, lineHeight: 1.7 }}>
            When a project exists, the client gets a link. Opening it asks for a six digit code, which goes to whoever signs that project off. That is the whole of how they get in.
          </p>
        </div>
        <div className="a-card">
          <span className="k">Who signs off</span>
          <p className="c-sub" style={{ fontSize: 14 }}>Asked on the project, not here. One business can have a different approver for a brand job than for a store rebuild.</p>
        </div>
      </div>
    </form>
  );
}
