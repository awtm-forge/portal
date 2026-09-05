"use client";

import { useActionState } from "react";
import { sendCodeAction, verifyCodeAction, type CodeState } from "./actions";

export function CodeScreen({ token, personName }: { token: string; personName: string }) {
  const [state, action, pending] = useActionState<CodeState, FormData>(
    async (prev, formData) => (prev.step === "enter" && formData.get("intent") !== "resend" ? verifyCodeAction(prev, formData) : sendCodeAction(prev, formData)),
    { step: "start" },
  );

  if (state.step === "start") {
    return (
      <div style={{ padding: "38px 20px", display: "flex", flexDirection: "column", gap: 22 }}>
        <div className="stack" style={{ gap: 8 }}>
          <p className="k">Confirming it is you</p>
          <h1 className="c-title" style={{ fontSize: 24 }}>We will send a six digit code</h1>
          <p className="c-sub">It goes to {personName}, the person named on this project. It is good for ten minutes, and once it is in, this phone stays signed in for thirty days.</p>
        </div>
        <form action={action} className="stack" style={{ gap: 12 }}>
          <input type="hidden" name="token" value={token} />
          <button className="btn-full" type="submit" disabled={pending}>{pending ? "Sending" : "Send the code"}</button>
          {state.message && <p className="help err">{state.message}</p>}
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: "38px 20px", display: "flex", flexDirection: "column", gap: 22 }}>
      <div className="stack" style={{ gap: 8 }}>
        <p className="k">Confirming it is you</p>
        <h1 className="c-title" style={{ fontSize: 24 }}>We sent a six digit code</h1>
        <p className="c-sub">It went to {state.sentTo}. It is good for ten minutes.</p>
      </div>
      <form action={action} className="stack" style={{ gap: 12 }}>
        <input type="hidden" name="token" value={token} />
        <div className="code-boxes">
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            disabled={state.locked || pending}
            aria-label="Six digit code"
          />
        </div>
        {state.message && <p className="help err">{state.message}</p>}
        <button className="btn-full" type="submit" disabled={state.locked || pending}>{pending ? "Checking" : "Confirm"}</button>
        <button className="link-mono" type="submit" name="intent" value="resend" disabled={pending} style={{ textAlign: "center" }}>Send it again</button>
      </form>
    </div>
  );
}
