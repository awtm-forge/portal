"use client";

import { useActionState } from "react";
import type { CompanyView } from "@/modules/settings";
import { saveSettingsAction, type SettingsState } from "./actions";

export function SettingsForm({ company }: { company: CompanyView }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettingsAction, {});
  return (
    <form action={action} className="a-cols">
      <div className="main">
        <div className="a-card">
          <span className="k">awtm forge</span>
          <div className="grid2">
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Name, as it goes on an invoice</span><input className="a-fld" name="name" defaultValue={company.name} required /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Email</span><input className="a-fld" name="email" type="email" defaultValue={company.email} required /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Phone, with the country code</span><input className="a-fld" name="phone" defaultValue={company.phone} placeholder="+91 99000 21188" /></label>
          </div>
          <label className="stack" style={{ gap: 6 }}><span className="lbl">Address</span><textarea className="a-fld" name="address" rows={3} defaultValue={company.address} /></label>
        </div>

        <div className="a-card">
          <span className="k">Where the money goes</span>
          <p className="c-sub" style={{ fontSize: 14 }}>Printed on every invoice. Invoices are paid by bank transfer and marked paid by hand; there is no gateway.</p>
          <div className="grid2">
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Bank</span><input className="a-fld" name="bankName" defaultValue={company.bankName ?? ""} /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Account name</span><input className="a-fld" name="bankAccountName" defaultValue={company.bankAccountName ?? ""} /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Account number</span><input className="a-fld" name="bankAccountNumber" defaultValue={company.bankAccountNumber ?? ""} /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">IFSC</span><input className="a-fld" name="bankIfsc" defaultValue={company.bankIfsc ?? ""} /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">UPI id</span><input className="a-fld" name="upiId" defaultValue={company.upiId ?? ""} /></label>
          </div>
        </div>

        <div className="a-card">
          <span className="k">Invoicing</span>
          <div className="grid2">
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Invoice prefix</span><input className="a-fld mono" name="invoicePrefix" defaultValue={company.invoicePrefix} required /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Default advance percentage</span><input className="a-fld" name="defaultAdvancePct" inputMode="numeric" defaultValue={company.defaultAdvancePct} required /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">GSTIN, when you register</span><input className="a-fld mono" name="gstin" defaultValue={company.gstin ?? ""} /></label>
          </div>
          <p className="help" style={{ lineHeight: 1.65 }}>
            Numbers read {company.invoicePrefix}/26-27/001 and restart at 001 each first of April. While the GSTIN is empty no tax line appears anywhere; filling it in is all that is needed to grow one.
          </p>
        </div>

        <div className="a-card">
          <span className="k">Booking</span>
          <label className="stack" style={{ gap: 6 }}><span className="lbl">The link a client books a sync through</span><input className="a-fld" name="bookingUrl" defaultValue={company.bookingUrl ?? ""} placeholder="https://calendar.app.google/..." /></label>
          <p className="help" style={{ lineHeight: 1.65 }}>
            A cal.com link, a Google appointment schedule or a Calendly. From Google, use the address inside the
            Inline booking page embed code rather than the plain Copy link, which is the one built to sit in a page.
            Whichever you use, set its meeting location to Google Meet so every booking carries a call link.
            Leave this empty and the Book a meeting button is hidden rather than broken.
          </p>
        </div>

        {state.message && <p className="help err">{state.message}</p>}
        <div><button className="a-btn" type="submit" disabled={pending}>{pending ? "Saving" : "Save settings"}</button></div>
      </div>

      <div className="aside">
        <div className="a-card">
          <span className="k">Nothing here belongs to a client</span>
          <p className="c-sub" style={{ fontSize: 14 }}>These are our own details. No client credential is stored anywhere in this system, and no field on this page is one.</p>
        </div>
      </div>
    </form>
  );
}
