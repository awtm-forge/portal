"use client";

import { useActionState } from "react";
import { cancelProjectAction, type CancelState } from "./actions";

/**
 * CLAUDE.md 5. The one move that ends a project without a delivery, so it sits
 * last on the page, under "Ending it early", and asks for a reason before it
 * will act: that required line is the confirmation. It is shown rather than
 * folded away (Ayush, 11 Sep 2026) so it can actually be found.
 */
export function CancelProject({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<CancelState, FormData>(cancelProjectAction, {});
  return (
    <form action={action} className="stack" style={{ gap: 10 }}>
      <input type="hidden" name="projectId" value={projectId} />
      <p className="help" style={{ lineHeight: 1.65 }}>
        The client page will say the project was closed, with the date. No invoice is created and no issued
        invoice changes: whatever was raised stays raised. There is no way back from this.
      </p>
      <label className="stack" style={{ gap: 6 }}>
        <span className="lbl">Why, in a line. Required, and only we ever read it.</span>
        <input className="a-fld" name="reason" maxLength={500} required />
      </label>
      {state.message && <p className="help err">{state.message}</p>}
      <div><button className="a-btn ghost" type="submit" disabled={pending}>{pending ? "Cancelling" : "Cancel it"}</button></div>
    </form>
  );
}
