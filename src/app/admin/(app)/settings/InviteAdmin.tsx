"use client";

import { useActionState } from "react";
import { inviteAdminAction, removeAdminAction, type InviteState } from "./adminActions";

type Existing = { email: string; name: string; hasPassword: boolean };

/**
 * The team, and how someone joins it.
 *
 * The form used to sit behind a folded grey summary that read as a caption
 * rather than a control, which is the third time that mistake has been made
 * on this codebase (Ayush, 14 Sep). It is open on the page now, with the three
 * steps written out beside it, because the thing that makes this flow
 * confusing is not the form, it is not knowing that we never set anybody's
 * password.
 */
const STEPS = [
  { what: "You make a setup link here", note: "Nothing is emailed and no password is set." },
  { what: "You send it to them yourself", note: "WhatsApp, a message, however you already talk." },
  { what: "They open it and choose a password", note: "Only they ever see it. It works once and lasts 48 hours." },
];

export function InviteAdmin({ admins }: { admins: Existing[] }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteAdminAction, {});
  const v = state.values;
  const full = admins.length >= 2;
  const waiting = admins.filter((a) => !a.hasPassword);

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
            <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="tag" style={{ color: a.hasPassword ? "var(--muted)" : "var(--accent)" }}>
                {a.hasPassword ? "can sign in" : "link not used yet"}
              </span>
              {!a.hasPassword && (
                <form action={removeAdminAction}>
                  <input type="hidden" name="email" value={a.email} />
                  <button className="link-mono" type="submit" style={{ padding: 0, fontSize: "10.5px", color: "var(--faint)" }}>Remove</button>
                </form>
              )}
            </span>
          </div>
        ))}
      </div>

      {state.link ? (
        <div className="stack" style={{ gap: 8, paddingTop: 6 }}>
          <span className="k ember">Setup link for {state.email}</span>
          <code className="mono-sm" style={{ wordBreak: "break-all", padding: "10px 12px", border: "1px solid var(--rule)", borderRadius: 2, display: "block" }}>
            {state.link}
          </code>
          <p className="help" style={{ lineHeight: 1.65 }}>
            Shown once, works once, lasts 48 hours. Send it to them now: this page cannot show it again, and if it is lost you make another one here, which stops this one working.
          </p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 14, paddingTop: 8, borderTop: "1px solid var(--rule-soft)" }}>
          <div className="stack" style={{ gap: 3 }}>
            <span className="sec-name">{full ? "Reissuing a setup link" : "Adding the other admin"}</span>
            <p className="help" style={{ lineHeight: 1.65 }}>
              {full
                ? "Two accounts is the limit and both are taken. Entering an address that is already above reissues its setup link, which is also how a forgotten password is reset. To swap somebody out, remove an unused invite first."
                : "Two accounts is the limit, and one seat is free. We never set anyone's password, so this makes a link instead."}
            </p>
          </div>

          <ol className="a-steps">
            {STEPS.map((s, i) => (
              <li key={s.what}>
                <span className="a-step-n">{i + 1}</span>
                <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <span className="a-step-w">{s.what}</span>
                  <span className="help">{s.note}</span>
                </span>
              </li>
            ))}
          </ol>

          {waiting.length > 0 && (
            <p className="help">
              {waiting.length === 1 ? `${waiting[0].name} has a link and has not used it yet.` : "Two links are out and neither has been used yet."}
            </p>
          )}

          <form action={action} className="stack" style={{ gap: 10 }}>
            <div className="grid2">
              <label className="stack" style={{ gap: 6 }}><span className="lbl">Email</span><input className="a-fld" type="email" name="email" maxLength={200} defaultValue={v?.email} required /></label>
              <label className="stack" style={{ gap: 6 }}><span className="lbl">Name</span><input className="a-fld" name="name" maxLength={120} defaultValue={v?.name} required /></label>
            </div>
            {state.message && <p className="help err">{state.message}</p>}
            <div>
              <button className="a-btn" type="submit" disabled={pending}>
                {pending ? "Making the link" : full ? "Reissue a setup link" : "Add an admin"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
