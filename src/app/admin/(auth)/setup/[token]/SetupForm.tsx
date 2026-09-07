"use client";

import { useActionState } from "react";
import { setPasswordAction, type SetupState } from "./actions";

export function SetupForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<SetupState, FormData>(setPasswordAction, {});
  return (
    <form action={action} className="stack" style={{ gap: 14, marginTop: 22 }}>
      <input type="hidden" name="token" value={token} />
      <label className="stack" style={{ gap: 6 }}>
        <span className="lbl">Password, at least twelve characters</span>
        <input className="fld" name="password" type="password" autoComplete="new-password" minLength={12} required autoFocus />
      </label>
      <label className="stack" style={{ gap: 6 }}>
        <span className="lbl">Again</span>
        <input className="fld" name="again" type="password" autoComplete="new-password" minLength={12} required />
      </label>
      {state.message && <p className="help err">{state.message}</p>}
      <button className="btn-full" type="submit" disabled={pending}>{pending ? "Saving" : "Set it and sign in"}</button>
    </form>
  );
}
