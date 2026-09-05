"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createProjectAction, type NewProjectState } from "../../actions";

export function NewProjectForm() {
  const [state, action, pending] = useActionState<NewProjectState, FormData>(createProjectAction, {});
  const v = state.values ?? {};
  return (
    <form action={action} className="a-cols">
      <div className="main">
        <div className="a-card">
          <span className="k">The client</span>
          <div className="grid2">
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Business name</span><input className="a-fld" name="businessName" defaultValue={v.businessName} required /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Contact name</span><input className="a-fld" name="contactName" defaultValue={v.contactName} required /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Contact phone, with country code</span><input className="a-fld" name="contactPhone" defaultValue={v.contactPhone} placeholder="+91 98450 12345" required /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Contact email</span><input className="a-fld" name="contactEmail" type="email" defaultValue={v.contactEmail} required /></label>
          </div>
        </div>
        <div className="a-card">
          <span className="k">The project</span>
          <div className="grid2">
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Project name</span><input className="a-fld" name="projectName" defaultValue={v.projectName} required /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Slug, used in the answers file. Blank to make one.</span><input className="a-fld mono" name="slug" defaultValue={v.slug} placeholder="kavya-appliances-store" /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Type of work</span>
              <select className="a-fld" name="typeOfWork" defaultValue={v.typeOfWork ?? "STORE"}>
                <option value="STORE">Store</option><option value="APP">App</option><option value="SAAS">SaaS</option><option value="MARKETING">Marketing</option><option value="BRAND">Brand</option>
              </select>
            </label>
          </div>
        </div>
        <div className="a-card ember">
          <span className="k ember">Who signs off</span>
          <p className="c-sub" style={{ fontSize: 14 }}>The six digit code goes to this address from the first login. The questionnaire prefills these two answers and can propose a change, which you confirm on the project page.</p>
          <div className="grid2">
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Sign-off person</span><input className="a-fld" name="signoffPersonName" defaultValue={v.signoffPersonName} required /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Their email</span><input className="a-fld" name="signoffPersonEmail" type="email" defaultValue={v.signoffPersonEmail} required /></label>
          </div>
        </div>
        {state.message && <p className="help err">{state.message}</p>}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="a-btn" type="submit" disabled={pending}>{pending ? "Creating" : "Create project and get the link"}</button>
          <Link className="a-btn ghost" href="/admin">Cancel</Link>
        </div>
      </div>
      <div className="aside">
        <div className="a-card">
          <span className="k">What happens next</span>
          <p className="c-sub" style={{ fontSize: 14 }}>You get the client link, once. Copy it. Upload the questionnaire, then send the link on WhatsApp. The client opens it, asks for the code, and sees the questionnaire.</p>
          <p className="help" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 12 }}>No field on this page or any other holds a client&rsquo;s password, key or OTP.</p>
        </div>
      </div>
    </form>
  );
}
