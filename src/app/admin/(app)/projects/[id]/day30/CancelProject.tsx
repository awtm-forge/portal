"use client";

import { useActionState } from "react";
import { cancelProjectAction, type CancelState } from "./actions";

/**
 * CLAUDE.md 5. Folded away, because it is the one move that ends a project
 * without a delivery and nobody should reach it while looking for something
 * else. The reason is required and the copy says why it is kept.
 */
export function CancelProject({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState<CancelState, FormData>(cancelProjectAction, {});
  return (
    <details className="stack" style={{ gap: 8, borderTop: "1px solid var(--rule-soft)", paddingTop: 12 }}>
      <summary className="link-mono" style={{ cursor: "pointer", listStyle: "none" }}>Cancel this project</summary>
      <form action={action} className="stack" style={{ gap: 10, paddingTop: 10 }}>
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
    </details>
  );
}
