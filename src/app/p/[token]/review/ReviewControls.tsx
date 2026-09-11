"use client";

import { useActionState } from "react";
import { ResendButton } from "@/components/portal/ResendButton";
import { confirmSignOffAction, requestChangesAction, startSignOffAction, type ReviewState } from "./actions";

/**
 * PORTAL-SPEC 6.4. One text box and one button. Saying what is off costs
 * nothing and needs no code; signing off asks for a fresh one, because that
 * is what makes it attributable.
 */
export function ReviewControls({ token, signoffPersonName }: { token: string; signoffPersonName: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(
    async (prev, formData) => {
      const intent = String(formData.get("intent") ?? "");
      if (intent === "changes") return requestChangesAction(prev, formData);
      if (intent === "start") return startSignOffAction(prev, formData);
      return confirmSignOffAction(prev, formData);
    },
    { step: "idle" },
  );

  if (state.noteSent) {
    return (
      <div className="card now" style={{ margin: "0 20px", padding: "18px 16px" }}>
        <div className="stack" style={{ gap: 10 }}>
          <span className="sec-name" style={{ fontSize: 17 }}>Thank you, we have it.</span>
          <p className="c-sub">We will put it right and send it back to you. Nothing is invoiced in the meantime.</p>
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
          {state.message && <p className="msg">{state.message}</p>}
          <button className="btn-full" type="submit" disabled={state.locked || pending}>{pending ? "Checking" : "Confirm and sign off"}</button>
        </form>
        <form action={action}>
          <input type="hidden" name="token" value={token} />
          <ResendButton pending={pending} value="start" block />
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 20px" }} className="stack">
      <form action={action} className="stack" style={{ gap: 10 }}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="intent" value="changes" />
        <label className="stack" style={{ gap: 6 }}>
          <span className="q">Anything that is off? Say it here and we keep working.</span>
          <p className="help">Nothing is invoiced until you are happy. There is no limit on how many times we go round.</p>
          <textarea className="fld" name="text" rows={4} maxLength={8000} placeholder="The returns label comes out at the wrong size." />
        </label>
        <button className="btn-full ghost" type="submit" disabled={pending}>Send this back to us</button>
      </form>

      <form action={action} style={{ marginTop: 22 }}>
        <input type="hidden" name="token" value={token} />
        <button className="btn-full" type="submit" name="intent" value="start" disabled={pending}>
          {pending ? "One moment" : "It holds. Sign off the delivery."}
        </button>
      </form>
      {state.message && <p className="msg" style={{ marginTop: 10 }}>{state.message}</p>}
      <p className="help" style={{ marginTop: 14 }}>
        Signing off asks for a six digit code, so the record shows who signed and when. It is also what raises the final invoice.
      </p>
    </div>
  );
}
