"use client";

import { useActionState } from "react";
import { confirmAgreeAction, pushBackAction, startAgreeAction, type AgreeState } from "./actions";

/**
 * PORTAL-SPEC 6.3 and the one-thing-to-do rule. One loud button, "I agree".
 * The push-back is present but quiet, and needs no code (CLAUDE.md 5.1).
 */
export function AgreeControls({ token, signoffPersonName }: { token: string; signoffPersonName: string }) {
  const [state, action, pending] = useActionState<AgreeState, FormData>(
    async (prev, formData) => {
      const intent = String(formData.get("intent") ?? "");
      if (intent === "push_back") return pushBackAction(prev, formData);
      if (intent === "start") return startAgreeAction(prev, formData);
      return confirmAgreeAction(prev, formData);
    },
    { step: "idle" },
  );

  if (state.noteSent) {
    return (
      <div className="card now" style={{ margin: "0 20px", padding: "18px 16px" }}>
        <div className="stack" style={{ gap: 10 }}>
          <span className="sec-name" style={{ fontSize: 17 }}>Thank you, we have it.</span>
          <p className="c-sub">Rahul will read it and send the agreement again with the change. Nothing is invoiced in the meantime.</p>
        </div>
      </div>
    );
  }

  if (state.step === "code") {
    return (
      <div style={{ padding: "0 20px" }} className="stack">
        <form action={action} className="stack" style={{ gap: 12 }}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="intent" value="confirm" />
          <p className="k">Confirming it is you</p>
          <p className="c-sub">We sent a six digit code to {state.sentTo}. It is good for ten minutes.</p>
          <label className="stack" style={{ gap: 6 }}>
            <span className="help">Your name, as it goes on the record</span>
            <input className="fld" name="name" defaultValue={signoffPersonName} maxLength={120} required />
          </label>
          <div className="code-boxes">
            <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus disabled={state.locked || pending} aria-label="Six digit code" />
          </div>
          {state.message && <p className="help err">{state.message}</p>}
          <button className="btn-full" type="submit" disabled={state.locked || pending}>{pending ? "Checking" : "Confirm and agree"}</button>
        </form>
        <form action={action}>
          <input type="hidden" name="token" value={token} />
          <button className="link-mono" type="submit" name="intent" value="start" disabled={pending} style={{ display: "block", width: "100%", textAlign: "center", padding: "12px 0" }}>Send it again</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 20px" }} className="stack">
      <form action={action}>
        <input type="hidden" name="token" value={token} />
        <button className="btn-full" type="submit" name="intent" value="start" disabled={pending}>{pending ? "One moment" : "I agree"}</button>
      </form>
      {state.message && <p className="help err" style={{ marginTop: 10 }}>{state.message}</p>}
      <div className="stack" style={{ gap: 10, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--rule-soft)" }}>
        <p className="sec-name" style={{ fontSize: 15 }}>Something not right?</p>
        <p className="c-sub">You do not have to agree as it stands. Tell us what is off and we will change it and send it again. No code needed, and nothing is invoiced until you agree.</p>
        <form action={action} className="stack" style={{ gap: 10 }}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="intent" value="push_back" />
          <label className="visually-hidden" htmlFor="pushback-text">What is off</label>
          <textarea id="pushback-text" className="fld" name="text" rows={4} required maxLength={8000} placeholder="The launch date does not work, we have stock arriving that week." />
          <button className="btn-full ghost" type="submit" disabled={pending}>Request a change</button>
        </form>
      </div>
      <p className="help" style={{ marginTop: 14 }}>Agreeing asks for a six digit code, so the record shows who agreed and when.</p>
    </div>
  );
}
