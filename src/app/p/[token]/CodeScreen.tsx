"use client";

import { useActionState } from "react";
import { sendCodeAction, verifyCodeAction, type CodeState } from "./actions";

export function CodeScreen({ token, personName, maskedEmail }: { token: string; personName: string; maskedEmail: string }) {
  const [state, action, pending] = useActionState<CodeState, FormData>(
    async (prev, formData) => (prev.step === "enter" && formData.get("intent") !== "resend" ? verifyCodeAction(prev, formData) : sendCodeAction(prev, formData)),
    { step: "start" },
  );

  if (state.step === "start") {
    return (
      <div style={{ padding: "38px 20px", display: "flex", flexDirection: "column", gap: 22 }}>
        <div className="stack" style={{ gap: 8 }}>
          <p className="k">First time on this phone</p>
          <h1 className="c-title" style={{ fontSize: 24 }}>One code and you are in</h1>
          <p className="c-sub">
            We will email six digits to {maskedEmail}, the address we have for {personName}. Type them in and this device stays signed in for thirty days, so you will not do this again for a while.
          </p>
          <p className="c-sub">There is no password to remember, now or ever.</p>
        </div>
        <form action={action} className="stack" style={{ gap: 12 }}>
          <input type="hidden" name="token" value={token} />
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
        <p className="c-sub">Six digits are on their way to {state.sentTo}. They last ten minutes. If nothing arrives, check the spam folder before asking for another.</p>
      </div>
      <form action={action} className="stack" style={{ gap: 12 }}>
        <input type="hidden" name="token" value={token} />
        <label className="k" htmlFor="code" style={{ color: "var(--muted)" }}>The six digit code from the email</label>
        <div className="code-boxes">
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="000000"
            required
            autoFocus
            disabled={state.locked || pending}
          />
        </div>
        {state.message && <p className="help err">{state.message}</p>}
        <button className="btn-full" type="submit" disabled={state.locked || pending}>{pending ? "Checking" : "Open my page"}</button>
        <button className="link-mono" type="submit" name="intent" value="resend" disabled={pending} style={{ textAlign: "center" }}>Send it again</button>
      </form>
    </div>
  );
}
