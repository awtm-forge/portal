"use client";

import { useActionState } from "react";
import { recordWhatsappAgreementAction, type RecordState } from "./actions";

/**
 * The WhatsApp fallback, PORTAL-SPEC 5.11. Deliberately as prominent as the
 * portal path: most clients will reply on WhatsApp, and a record that only
 * exists when they tap is a record that mostly does not exist.
 */
export function RecordWhatsapp({
  projectId,
  suggestedName,
  today,
}: {
  projectId: string;
  suggestedName: string;
  today: string;
}) {
  const [state, action, pending] = useActionState<RecordState, FormData>(recordWhatsappAgreementAction, {});
  const v = state.values ?? {};

  return (
    <details className="a-card">
      <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span className="k">They agreed on WhatsApp instead</span>
        <span className="mono-sm" style={{ color: "var(--ember)" }}>Record it</span>
      </summary>
      <form action={action} className="stack" style={{ gap: 14, paddingTop: 16 }}>
        <input type="hidden" name="projectId" value={projectId} />
        <p className="c-sub" style={{ fontSize: 14 }}>
          A client who replies on WhatsApp has agreed just as much as one who tapped. This writes the same sign-off and raises the same advance invoice. It does not pretend they tapped: the record says WhatsApp, keeps what they wrote, and stays that way forever.
        </p>
        <div className="grid2">
          <label className="stack" style={{ gap: 6 }}>
            <span className="lbl">Who said it</span>
            <input className="a-fld" name="actorName" defaultValue={v.actorName ?? suggestedName} required />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="lbl">The day they said it</span>
            <input className="a-fld" type="date" name="occurredOn" defaultValue={v.occurredOn ?? today} max={today} required />
          </label>
        </div>
        <label className="stack" style={{ gap: 6 }}>
          <span className="lbl">Paste what they sent, exactly</span>
          <textarea className="a-fld" name="rawNote" rows={4} defaultValue={v.rawNote} placeholder="ok done, go ahead" required />
        </label>
        <p className="help">Paste it as they wrote it. Tidying it up is the one thing that would make this worth less later.</p>
        {state.message && <p className="help err">{state.message}</p>}
        <div><button className="a-btn" type="submit" disabled={pending}>{pending ? "Recording" : "Record their yes"}</button></div>
      </form>
    </details>
  );
}
