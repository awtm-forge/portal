"use client";

import { useActionState } from "react";
import { sendThanksAction, type ThanksState } from "./actions";

/** CLAUDE.md 5.1. Two optional fields and one button. Sending nothing is fine. */
export function ThanksForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ThanksState, FormData>(sendThanksAction, {});
  const v = state.values;
  return (
    <form action={action} className="stack" style={{ gap: 18, padding: "0" }}>
      <input type="hidden" name="token" value={token} />
      <label className="stack" style={{ gap: 6 }}>
        <span className="q">One or two lines on how this went, in your words.</span>
        <p className="help">Optional. We would only ever use it with your name on it if you say so later.</p>
        <textarea className="fld" name="quote" rows={4} maxLength={4000} defaultValue={v?.quote} />
      </label>
      <div className="stack" style={{ gap: 6 }}>
        <span className="q">Know someone with the same problem?</span>
        <p className="help">Optional. Their name and how to reach them, and we will mention you.</p>
        <input className="fld" name="referralName" placeholder="Their name" maxLength={120} defaultValue={v?.referralName} />
        <input className="fld" name="referralContact" placeholder="A number or an email" maxLength={200} defaultValue={v?.referralContact} style={{ marginTop: 8 }} />
      </div>
      {state.message && <p className="help err">{state.message}</p>}
      <button className="btn-full" type="submit" disabled={pending}>{pending ? "Sending" : "Send"}</button>
      <button className="link-mono" type="submit" name="intent" value="skip" disabled={pending} style={{ textAlign: "center", padding: "4px 0 12px" }}>Skip</button>
    </form>
  );
}
