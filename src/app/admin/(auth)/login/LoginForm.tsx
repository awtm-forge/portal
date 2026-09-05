"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="stack" style={{ gap: 14, marginTop: 22 }}>
      <label className="stack" style={{ gap: 6 }}><span className="lbl">Email</span><input className="fld" name="email" type="email" autoComplete="username" required /></label>
      <label className="stack" style={{ gap: 6 }}><span className="lbl">Password</span><input className="fld" name="password" type="password" autoComplete="current-password" required /></label>
      {state.message && <p className="help err">{state.message}</p>}
      <button className="btn-full" type="submit" disabled={pending}>{pending ? "Checking" : "Sign in"}</button>
    </form>
  );
}
