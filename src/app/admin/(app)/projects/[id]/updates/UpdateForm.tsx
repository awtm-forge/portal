"use client";

import { useActionState, useState } from "react";
import { waLink, weeklyUpdateMessage } from "@/lib/whatsapp";
import { saveUpdateAction, type UpdateState } from "./actions";

type Values = { moved: string; nextUp: string; needFromYou: string; needByDate: string; risks: string; stagingUrl: string };

const EMPTY: Values = { moved: "", nextUp: "", needFromYou: "", needByDate: "", risks: "", stagingUrl: "" };

/**
 * PORTAL-SPEC 4: five fields, the same five every week. The WhatsApp message
 * is built from what is typed, so the page and the message cannot disagree.
 */
export function UpdateForm({
  projectId,
  weekNumber,
  sent,
  contactName,
  contactPhone,
  weekCount,
  values,
}: {
  projectId: string;
  weekNumber: number;
  sent: boolean;
  contactName: string;
  contactPhone: string;
  weekCount: number | null;
  values: Values | null;
}) {
  const [state, action, pending] = useActionState<UpdateState, FormData>(saveUpdateAction, {});
  const [draft, setDraft] = useState<Values>(values ?? (state.values as unknown as Values) ?? EMPTY);
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  const message = weeklyUpdateMessage({
    contactName: contactName.trim().split(/\s+/)[0] || contactName,
    weekNumber,
    weekCount,
    moved: draft.moved || "…",
    nextUp: draft.nextUp || "…",
    needFromYou: draft.needFromYou,
    needByDate: draft.needByDate,
    risks: draft.risks,
  });

  if (sent) {
    return (
      <div className="a-card">
        <span className="k">Week {weekNumber}, sent</span>
        <p className="c-sub" style={{ fontSize: 14 }}>
          The client has read this, so it cannot be changed. If something in it was wrong, say so in the next week&rsquo;s update rather than quietly editing this one.
        </p>
        <div className="stack">
          {([["Moved", draft.moved], ["Next up", draft.nextUp], ["Need from you", draft.needFromYou], ["Risks", draft.risks]] as const).map(([label, value]) => (
            <div className="row" key={label}>
              <span className="lbl">{label}</span>
              <p style={{ margin: 0, fontSize: 14.5, whiteSpace: "pre-wrap" }}>{value || "Nothing"}</p>
            </div>
          ))}
        </div>
        <div><a className="a-btn ghost" href={waLink(contactPhone, message)} target="_blank" rel="noopener">Send it on WhatsApp again</a></div>
      </div>
    );
  }

  return (
    <>
      <form action={action} className="a-card">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="weekNumber" value={weekNumber} />
        <span className="k">The five fields, the same every week</span>
        <label className="stack" style={{ gap: 6 }}>
          <span className="lbl">What moved</span>
          <textarea className="a-fld" name="moved" rows={3} value={draft.moved} onChange={set("moved")} required />
        </label>
        <label className="stack" style={{ gap: 6 }}>
          <span className="lbl">What is next</span>
          <textarea className="a-fld" name="nextUp" rows={3} value={draft.nextUp} onChange={set("nextUp")} required />
        </label>
        <div className="grid2">
          <label className="stack" style={{ gap: 6 }}>
            <span className="lbl">What you need from them</span>
            <textarea className="a-fld" name="needFromYou" rows={2} value={draft.needFromYou} onChange={set("needFromYou")} />
          </label>
          <label className="stack" style={{ gap: 6 }}>
            <span className="lbl">By when</span>
            <input className="a-fld" type="date" name="needByDate" value={draft.needByDate} onChange={set("needByDate")} />
          </label>
        </div>
        <label className="stack" style={{ gap: 6 }}>
          <span className="lbl">Risks. Say none rather than leaving it blank.</span>
          <textarea className="a-fld" name="risks" rows={2} value={draft.risks} onChange={set("risks")} placeholder="None this week." />
        </label>
        <label className="stack" style={{ gap: 6 }}>
          <span className="lbl">Staging link, if there is one this week</span>
          <input className="a-fld" name="stagingUrl" value={draft.stagingUrl} onChange={set("stagingUrl")} placeholder="https://" />
        </label>
        {state.message && <p className="help err">{state.message}</p>}
        {state.ok && <p className="help">{state.ok}</p>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="a-btn" type="submit" name="intent" value="send" disabled={pending}>{pending ? "Working" : "Send it to the client"}</button>
          <button className="a-btn ghost" type="submit" name="intent" value="save" disabled={pending}>Save as a draft</button>
        </div>
        <p className="help">A written update every week, whether or not anything went wrong. That is the promise in the agreement.</p>
      </form>

      <div className="a-card">
        <div className="between"><span className="k">The WhatsApp message, as it stands</span><span className="help">Built from what you typed</span></div>
        <div style={{ border: "1px solid var(--rule)", background: "var(--surface-2)", borderRadius: 2, padding: "14px 16px", fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", color: "var(--ink)" }}>{message}</div>
        <div><a className="a-btn ghost" href={waLink(contactPhone, message)} target="_blank" rel="noopener">Open WhatsApp with this</a></div>
        <p className="help">Send it after the page update, so the two say the same thing.</p>
      </div>
    </>
  );
}
