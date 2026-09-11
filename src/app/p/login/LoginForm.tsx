"use client";

import { useActionState } from "react";
import { sendLoginCodeAction, verifyLoginCodeAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    async (prev, formData) => (prev.step === "enter" && formData.get("intent") !== "resend" ? verifyLoginCodeAction(prev, formData) : sendLoginCodeAction(prev, formData)),
    { step: "start" },
  );

  if (state.step === "start") {
    return (
      <div style={{ padding: "38px 20px", display: "flex", flexDirection: "column", gap: 22 }}>
        <div className="stack" style={{ gap: 8 }}>
          <p className="k">Log in to your page</p>
          <h1 className="c-title" style={{ fontSize: 24 }}>Lost your link? Get back in</h1>
          <p className="c-sub">Give us the email you gave us, and we will send a six digit code to it. There is no password, now or ever.</p>
        </div>
        <form action={action} className="stack" style={{ gap: 12 }}>
          <label className="visually-hidden" htmlFor="login-email">Your email</label>
          <input id="login-email" className="fld" name="email" type="email" autoComplete="email" defaultValue={state.email} placeholder="you@yourbusiness.com" required autoFocus />
          <button className="btn-full" type="submit" disabled={pending}>{pending ? "Sending" : "Email me a code"}</button>
          {state.message && <p className="help err">{state.message}</p>}
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: "38px 20px", display: "flex", flexDirection: "column", gap: 22 }}>
      <div className="stack" style={{ gap: 8 }}>
        <p className="k">Almost in</p>
        <h1 className="c-title" style={{ fontSize: 24 }}>Have a look at your email</h1>
        <p className="c-sub">If we have a page for {state.sentTo}, six digits are on their way. They last ten minutes. If nothing arrives, check the spam folder before asking for another.</p>
      </div>
      <form action={action} className="stack" style={{ gap: 12 }}>
        <input type="hidden" name="email" value={state.email ?? ""} />
        <div className="code-boxes">
          <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus disabled={state.locked || pending} aria-label="Six digit code" />
        </div>
        {state.message && <p className="help err">{state.message}</p>}
        <button className="btn-full" type="submit" disabled={state.locked || pending}>{pending ? "Checking" : "Log in"}</button>
        <button className="link-mono" type="submit" name="intent" value="resend" disabled={pending} style={{ textAlign: "center" }}>Send it again</button>
      </form>
    </div>
  );
}
