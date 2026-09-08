"use client";

import { useActionState } from "react";
import { markReadyAction, type MarkReadyState } from "./actions";

export function MarkReady({ projectId, suggestedUrl }: { projectId: string; suggestedUrl: string }) {
  const [state, action, pending] = useActionState<MarkReadyState, FormData>(markReadyAction, {});
  return (
    <form action={action} className="a-card ember">
      <input type="hidden" name="projectId" value={projectId} />
      <span className="k ember">When the work is finished</span>
      <p className="c-sub" style={{ fontSize: 14 }}>
        Marking ready sends the whole thing to the client to check against the deliverables. Only do it when the work is finished: there is one review, not a series of previews.
      </p>
      <label className="stack" style={{ gap: 6 }}>
        <span className="lbl">Where they can see the finished work</span>
        <input className="a-fld" name="finishedWorkUrl" defaultValue={state.values?.finishedWorkUrl ?? suggestedUrl} placeholder="https://" required />
      </label>
      <p className="help">A live site, a staging link, or a folder of the finished files. Whatever they should be looking at.</p>
      {state.message && <p className="help err">{state.message}</p>}
      <div><button className="a-btn" type="submit" disabled={pending}>{pending ? "Sending" : "Mark it ready for them"}</button></div>
    </form>
  );
}
