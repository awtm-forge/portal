"use client";

import { useActionState } from "react";
import { inviteAdminAction, type InviteState } from "./adminActions";

type Existing = { email: string; name: string; hasPassword: boolean };

export function InviteAdmin({ admins }: { admins: Existing[] }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteAdminAction, {});
  const v = state.values;
  const full = admins.length >= 2;

  return (
    <div className="a-card">
      <span className="k">The team</span>
      <div className="stack">
        {admins.map((a) => (
          <div className="between" key={a.email} style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}>
            <span className="stack" style={{ gap: 2 }}>
              <span style={{ fontSize: 14.5 }}>{a.name}</span>
              <span className="mono-sm">{a.email}</span>
            </span>
            <span className="tag" style={{ color: a.hasPassword ? "var(--muted)" : "var(--ember)" }}>
              {a.hasPassword ? "can sign in" : "link not used yet"}
            </span>
          </div>
        ))}
      </div>

      {state.link ? (
        <div className="stack" style={{ gap: 8, paddingTop: 6 }}>
          <span className="lbl">Setup link for {state.email}. Shown once, works once, lasts 48 hours.</span>
          <code className="mono-sm" style={{ wordBreak: "break-all", padding: "10px 12px", border: "1px solid var(--rule)", borderRadius: 2, display: "block" }}>
            {state.link}
          </code>
          <p className="help">Send it to them on WhatsApp. They choose their own password when they open it; nobody else ever sees it. If it is lost, do this again and the old link stops working.</p>
        </div>
      ) : (
        <details className="stack" style={{ gap: 8, paddingTop: 6 }}>
          <summary className="link-mono" style={{ cursor: "pointer", listStyle: "none" }}>
            {full ? "Reissue a setup link" : "Add the other admin"}
          </summary>
          <form action={action} className="stack" style={{ gap: 10, paddingTop: 10 }}>
            <p className="help" style={{ lineHeight: 1.65 }}>
              {full
                ? "Both seats are taken. Enter one of the two addresses to give that person a fresh setup link, which is also how a forgotten password is reset."
                : "Two accounts is the limit. This makes the second, or refreshes an existing one. It never sets a password: they choose their own."}
            </p>
            <div className="grid2">
              <label className="stack" style={{ gap: 6 }}><span className="lbl">Email</span><input className="a-fld" type="email" name="email" maxLength={200} defaultValue={v?.email} required /></label>
              <label className="stack" style={{ gap: 6 }}><span className="lbl">Name</span><input className="a-fld" name="name" maxLength={120} defaultValue={v?.name} required /></label>
            </div>
            {state.message && <p className="help err">{state.message}</p>}
            <div><button className="a-btn ghost" type="submit" disabled={pending}>{pending ? "Making the link" : "Make the setup link"}</button></div>
          </form>
        </details>
      )}
    </div>
  );
}
