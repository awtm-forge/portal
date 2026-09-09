"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importAction, type ImportState } from "./actions";

const RULES = [
  "version is 1",
  "keys unique, lowercase, letters digits underscores",
  "type is one of the eight",
  "choices have two or more options, unique ids",
  "image keys exist in the library",
  "uploads allow 1 to 10 files",
  "exactly one access section, no uploads in it, no required except the two",
  "dec_signoff_name and dec_signoff_email present, short_text, required",
  "60 questions at most",
  "text on every question",
];

export function UploadForm({ clientId, hasAnswers, firstTime, linkSent }: { clientId: string; hasAnswers: boolean; firstTime: boolean; linkSent: boolean }) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importAction, {});
  return (
    <form action={action} className="a-cols" encType="multipart/form-data">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="main">
        <div className="a-card">
          <span className="k">Paste the JSON, or choose the file</span>
          <textarea className="a-fld mono" name="json" defaultValue={state.json} rows={14} placeholder='{ "version": 1, "title": "Before we start", ... }' />
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="a-btn" type="submit" disabled={pending}>{pending ? "Checking" : firstTime ? "Check it and send" : "Check it and replace"}</button>
            <input type="file" name="file" accept="application/json,.json" className="mono-sm" />
          </div>
          <p className="help" style={{ lineHeight: 1.65 }}>
            {firstTime && !linkSent
              ? "Sending this puts the questionnaire on their page and emails them their link, which has not gone out yet."
              : firstTime
                ? "Sending this puts the questionnaire on their page. Their link already went."
                : "This replaces the document on a page they already have. Nothing is emailed."}
          </p>
          {hasAnswers && (
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", borderTop: "1px solid var(--rule-soft)", paddingTop: 12, fontSize: 13.5, color: "var(--muted)" }}>
              <input type="checkbox" name="confirm" style={{ marginTop: 4 }} />
              <span>Answers exist. I understand that every answer is kept, and answers to keys no longer in the document are hidden, not deleted.</span>
            </label>
          )}
        </div>
        {state.message && <p className="help err">{state.message}</p>}
        {state.failures && state.failures.length > 0 && (
          <div className="a-card ember">
            <span className="k ember">Import failed. Nothing was saved.</span>
            <div className="stack">
              {state.failures.map((f, i) => (
                <div className="row" key={i}>
                  <span className="lbl">{f.rule.replace(/_/g, " ")}</span>
                  <p style={{ margin: 0, fontSize: 14 }}>{f.key && <span className="mono-sm" style={{ color: "var(--ember)", marginRight: 8 }}>{f.key}</span>}{f.message}</p>
                </div>
              ))}
            </div>
            <p className="help" style={{ lineHeight: 1.65 }}>Every rule is checked and every failure is listed, so one upload shows the whole set. Fix the document in conversation and paste it again.</p>
          </div>
        )}
        <div><Link className="a-btn ghost" href={`/admin/clients/${clientId}`}>Back to the client</Link></div>
      </div>
      <div className="aside">
        <div className="a-card">
          <span className="k">What the importer checks</span>
          <p className="help" style={{ lineHeight: 1.8 }}>{RULES.map((r, i) => <span key={i}>{r}<br /></span>)}</p>
        </div>
      </div>
    </form>
  );
}
