"use client";

import { useActionState } from "react";
import type { Day30ClientView } from "@/modules/serializers";
import { submitDay30Action, type Day30State } from "./actions";

/**
 * PORTAL-SPEC 6.5: the metric line, one field, the quote in an editable box,
 * two switches and one button. No referral section here; that was asked once,
 * on the thank-you page, and asking twice would be pestering.
 *
 * Both fields are optional, like the thank-you page. Someone willing to give
 * the number but not a quote should not be stopped at the door.
 */
export function Day30Form({ token, view, draft }: { token: string; view: Day30ClientView; draft: string }) {
  const [state, action, pending] = useActionState<Day30State, FormData>(submitDay30Action, {});
  const v = state.values;

  return (
    <form action={action} className="stack" style={{ gap: 20, padding: "0 20px" }}>
      <input type="hidden" name="token" value={token} />

      <label className="stack" style={{ gap: 6 }}>
        <span className="q">{view.metricName ? `${view.metricName}, and now?` : "What changed?"}</span>
        {view.metricBaseline && (
          <p className="help">
            It was {view.metricBaseline}
            {view.metricBaselineCapturedAt ? ` when we started, on ${view.metricBaselineCapturedAt}` : " when we started"}.
          </p>
        )}
        <input
          className="fld"
          name="metricAfter"
          maxLength={200}
          defaultValue={v?.metricAfter}
          placeholder={view.metricBaseline ? "Whatever it is today" : "A number, or a sentence"}
        />
      </label>

      <div className="stack" style={{ gap: 6 }}>
        <span className="q">How would you put it, now that you have lived with it?</span>
        <p className="help">
          {draft
            ? "This is what you wrote on the day we delivered. Change anything you like, or leave it."
            : "Optional. A line or two in your own words."}
        </p>
        <textarea className="fld" name="quote" rows={3} maxLength={4000} defaultValue={v?.quote ?? draft} />
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {/* The box sits with its label, not at the far edge of the column:
            space-between reads fine at 375px and falls apart at 900. */}
        <label className="tickrow">
          <input type="checkbox" name="useName" defaultChecked={v?.useName} />
          <span>You may use my name and my company with it</span>
        </label>
        <label className="tickrow">
          <input type="checkbox" name="useLogo" defaultChecked={v?.useLogo} />
          <span>You may use our logo with it</span>
        </label>
        <p className="help">Both off by default. We use nothing you have not ticked.</p>
      </div>

      {state.message && <p className="help err">{state.message}</p>}
      <button className="btn-full" type="submit" disabled={pending}>
        {pending ? "Sending" : "Approve and send"}
      </button>
    </form>
  );
}
