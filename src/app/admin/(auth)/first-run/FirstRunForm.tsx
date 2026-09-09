"use client";

import { useActionState } from "react";
import { firstRunAction, type FirstRunState } from "./actions";

export function FirstRunForm() {
  const [state, action, pending] = useActionState<FirstRunState, FormData>(firstRunAction, {});
  const v = state.values;
  return (
    <form action={action} className="stack" style={{ gap: 14, paddingTop: 22 }}>
      <label className="stack" style={{ gap: 6 }}>
        <span className="q">Your email, which is what you will sign in with</span>
        <input className="fld" name="email" type="email" maxLength={200} defaultValue={v?.email} required />
      </label>
      <label className="stack" style={{ gap: 6 }}>
        <span className="q">Your name, which is what the admin pages show</span>
        <input className="fld" name="name" maxLength={120} defaultValue={v?.name} required />
      </label>
      <label className="stack" style={{ gap: 6 }}>
        <span className="q">The setup key from the hosting panel</span>
        <p className="help">The value of SETUP_KEY. It proves you are the person who deployed this.</p>
        <input className="fld" name="key" type="password" autoComplete="off" required />
      </label>
      {state.message && <p className="help err">{state.message}</p>}
      <button className="btn-full" type="submit" disabled={pending}>
        {pending ? "Making it" : "Make the first account"}
      </button>
      <p className="help">You will choose a password on the next screen. Nobody else ever sees it.</p>
    </form>
  );
}
