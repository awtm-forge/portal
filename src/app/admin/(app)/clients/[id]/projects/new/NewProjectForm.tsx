"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createProjectAction, type NewProjectState } from "../../../../actions";

type ClientBrief = { id: string; businessName: string; contactName: string; contactEmail: string };

export function NewProjectForm({ client }: { client: ClientBrief }) {
  const [state, action, pending] = useActionState<NewProjectState, FormData>(createProjectAction, {});
  const [sameAsContact, setSameAsContact] = useState(true);
  const v = state.values ?? {};

  return (
    <form action={action} className="a-cols">
      <input type="hidden" name="clientId" value={client.id} />
      <div className="main">
        <div className="a-card">
          <div className="between"><span className="k">The client</span><Link className="mono-sm" href="/admin/clients">Change</Link></div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="sec-name" style={{ fontSize: 16 }}>{client.businessName}</span>
            <span className="mono-sm">{client.contactName} · {client.contactEmail}</span>
          </div>
        </div>

        <div className="a-card">
          <span className="k">The project</span>
          <div className="grid2">
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Project name</span><input className="a-fld" name="projectName" defaultValue={v.projectName} required autoFocus /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Slug, used in the answers file. Blank to make one.</span><input className="a-fld mono" name="slug" defaultValue={v.slug} /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Type of work</span>
              <select className="a-fld" name="typeOfWork" defaultValue={v.typeOfWork ?? "STORE"}>
                <option value="STORE">Store</option><option value="APP">App</option><option value="SAAS">SaaS</option><option value="MARKETING">Marketing</option><option value="BRAND">Brand</option>
              </select>
            </label>
          </div>
        </div>

        <div className="a-card ember">
          <span className="k ember">Who says yes on this project</span>
          <p className="c-sub" style={{ fontSize: 14 }}>
            The person who agrees the price and signs off the delivery. Their email is where the six digit code goes, so it has to be one they read.
          </p>
          <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13.5, color: "var(--muted)" }}>
            <input type="checkbox" checked={sameAsContact} onChange={(e) => setSameAsContact(e.target.checked)} />
            Same as {client.contactName}, who we talk to day to day
          </label>
          <div className="grid2">
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Name</span>
              <input className="a-fld" name="signoffPersonName" required key={`n${sameAsContact}`} defaultValue={sameAsContact ? client.contactName : (v.signoffPersonName ?? "")} readOnly={sameAsContact} />
            </label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Their email</span>
              <input className="a-fld" name="signoffPersonEmail" type="email" required key={`e${sameAsContact}`} defaultValue={sameAsContact ? client.contactEmail : (v.signoffPersonEmail ?? "")} readOnly={sameAsContact} />
            </label>
          </div>
        </div>

        {state.message && <p className="help err">{state.message}</p>}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="a-btn" type="submit" disabled={pending}>{pending ? "Creating" : "Start the project"}</button>
          <Link className="a-btn ghost" href={`/admin/clients/${client.id}`}>Cancel</Link>
        </div>
      </div>

      <div className="aside">
        <div className="a-card">
          <span className="k">In order</span>
          <p className="help" style={{ lineHeight: 1.9 }}>
            1. Create the project, here.<br />
            2. Send them the link, next screen.<br />
            3. Upload their questionnaire.<br />
            4. They answer it.<br />
            5. You write the agreement.
          </p>
          <p className="help" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 12, lineHeight: 1.65 }}>
            Two and three can happen either way round. The client sees nothing to do yet until the questionnaire is up.
          </p>
        </div>
      </div>
    </form>
  );
}
