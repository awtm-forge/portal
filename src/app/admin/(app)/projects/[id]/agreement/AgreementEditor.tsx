"use client";

import { useActionState, useState } from "react";
import type { AgreementAdminView } from "@/modules/serializers";
import { saveAgreementAction, type EditorState } from "./actions";

type ProjectFields = {
  weekCount: number | null;
  metricName: string | null;
  metricBaselineValue: string | null;
  afterDelivery: string;
  retainerTier: string | null;
  retainerNamedPerson: string | null;
  retainerResponseTime: string | null;
  handoverDocUrl: string | null;
};

type Props = {
  projectId: string;
  view: AgreementAdminView | null;
  frozen: boolean;
  canSend: boolean;
  defaultAdvancePct: number;
  bookingUrl: string | null;
  project: ProjectFields;
  suggestedMetric: string;
  totalPaise: string;
  internalCostPaise: string;
  startDateIso: string;
  launchDateIso: string;
};

const HOW_WE_WORK_DEFAULT = [
  "A short written update every week, whether or not anything went wrong: what moved, what is next, what we need from you and by when.",
  "A call every two weeks that either of us can book.",
  "You can open the work on a real link whenever you want.",
].join("\n");

const IF_WE_MISS_DEFAULT =
  "If a date is going to slip, we tell you in the weekly update before it slips, with the new date and the reason. We do not quietly move it.";

function rupees(paise: string): string {
  const n = BigInt(paise || "0");
  return n === 0n ? "" : (n / 100n).toString();
}

export function AgreementEditor(p: Props) {
  const [state, action, pending] = useActionState<EditorState, FormData>(saveAgreementAction, {});
  const [deliverables, setDeliverables] = useState(
    p.view?.deliverables.length ? p.view.deliverables : [{ key: "d1", text: "", how_to_check: "" }],
  );
  const [milestones, setMilestones] = useState(p.view?.milestones ?? []);

  if (p.frozen && p.view) {
    return (
      <div className="a-card">
        <span className="k">Frozen</span>
        <p className="c-sub" style={{ fontSize: 14 }}>
          Agreed by {p.view.agreedByName} on {p.view.agreedAt}, version {p.view.version}. PORTAL-SPEC 5.4: after that the agreement is read only forever. A change is new work with a new agreement, or a note on the record.
        </p>
        <div className="stack">
          <div className="row"><span className="lbl">What we are building</span><p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{p.view.scope}</p></div>
          <div className="row"><span className="lbl">Price</span><p style={{ margin: 0 }}>{p.view.total}, advance {p.view.advancePct} percent ({p.view.advance}), balance {p.view.balance}</p></div>
          <div className="row"><span className="lbl">Internal cost, never shown to the client</span><p style={{ margin: 0 }}>{p.view.internalCost}</p></div>
          {p.view.internalNotes && <div className="row"><span className="lbl">Internal notes</span><p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{p.view.internalNotes}</p></div>}
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="a-cols">
      <input type="hidden" name="projectId" value={p.projectId} />
      <div className="main">
        <div className="a-card">
          <span className="k">What we are building, in their words</span>
          <textarea className="a-fld" name="scope" rows={5} defaultValue={p.view?.scope ?? ""} placeholder="Lift the three phrases from the questionnaire almost unchanged." required />
        </div>

        <div className="a-card">
          <div className="between">
            <span className="k">Deliverables, and how they check each one</span>
            <button className="a-btn ghost" type="button" onClick={() => setDeliverables((d) => [...d, { key: `d${d.length + 1}`, text: "", how_to_check: "" }])}>Add one</button>
          </div>
          <p className="help">The review page shows this list with the how-to-check line beside each. Write the check as something they can do themselves.</p>
          {deliverables.map((d, i) => (
            <div className="grid2" key={i} style={{ borderTop: i === 0 ? "none" : "1px solid var(--rule-soft)", paddingTop: i === 0 ? 0 : 12 }}>
              <label className="stack" style={{ gap: 6 }}><span className="lbl">Deliverable {i + 1}</span><input className="a-fld" name="deliverable_text" defaultValue={d.text} /></label>
              <label className="stack" style={{ gap: 6 }}><span className="lbl">How they check it</span><input className="a-fld" name="deliverable_check" defaultValue={d.how_to_check} /></label>
            </div>
          ))}
        </div>

        <div className="a-card">
          <span className="k">What is not included</span>
          <textarea className="a-fld" name="notIncluded" rows={3} defaultValue={p.view?.notIncluded ?? ""} placeholder="Say it plainly. This is the line that prevents an argument later." />
        </div>

        <div className="a-card">
          <span className="k">Dates</span>
          <div className="grid2">
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Start</span><input className="a-fld" type="date" name="startDate" defaultValue={p.startDateIso} /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Launch target</span><input className="a-fld" type="date" name="launchTargetDate" defaultValue={p.launchDateIso} /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Build length in weeks, for the week counter</span><input className="a-fld" name="weekCount" defaultValue={p.project.weekCount ?? ""} inputMode="numeric" /></label>
          </div>
          <div className="between">
            <span className="k">Milestones, shown as dates and never as sign-offs</span>
            <button className="a-btn ghost" type="button" onClick={() => setMilestones((m) => [...m, { label: "", date: "" }])}>Add one</button>
          </div>
          {milestones.map((m, i) => (
            <div className="grid2" key={i}>
              <label className="stack" style={{ gap: 6 }}><span className="lbl">Label</span><input className="a-fld" name="milestone_label" defaultValue={m.label} /></label>
              <label className="stack" style={{ gap: 6 }}><span className="lbl">Date</span><input className="a-fld" type="date" name="milestone_date" defaultValue={m.date} /></label>
            </div>
          ))}
        </div>

        <div className="a-card">
          <span className="k">The price</span>
          <div className="grid2">
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Total, in rupees</span><input className="a-fld" name="total" defaultValue={rupees(p.totalPaise)} inputMode="decimal" placeholder="480000" required /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Advance percentage</span><input className="a-fld" name="advancePct" defaultValue={p.view?.advancePct ?? p.defaultAdvancePct} inputMode="numeric" required /></label>
          </div>
          <p className="help">The advance is invoiced the moment they agree. The balance is invoiced when they sign off the delivery. The advance rounds down so the two always add up to the total exactly.</p>
        </div>

        <div className="a-card">
          <span className="k">How we work, and what happens if we miss</span>
          <textarea className="a-fld" name="howWeWork" rows={4} defaultValue={p.view?.howWeWork ?? HOW_WE_WORK_DEFAULT} />
          {p.bookingUrl ? <p className="help">The booking link from settings is shown to the client beside this.</p> : <p className="help">No booking link in settings yet, so the Book a sync button stays hidden.</p>}
          <textarea className="a-fld" name="ifWeMiss" rows={3} defaultValue={p.view?.ifWeMiss ?? IF_WE_MISS_DEFAULT} />
        </div>

        <div className="a-card">
          <span className="k">After delivery</span>
          <textarea className="a-fld" name="afterDeliveryOffer" rows={3} defaultValue={p.view?.afterDeliveryOffer ?? ""} placeholder="The retainer terms, or what the handover includes." />
          <div className="grid2">
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Which is it</span>
              <select className="a-fld" name="afterDelivery" defaultValue={p.project.afterDelivery}>
                <option value="UNDECIDED">Not decided yet</option>
                <option value="RETAINER">A retainer</option>
                <option value="HANDOVER">A handover</option>
              </select>
            </label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Retainer tier</span><input className="a-fld" name="retainerTier" defaultValue={p.project.retainerTier ?? ""} /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Their named person</span><input className="a-fld" name="retainerNamedPerson" defaultValue={p.project.retainerNamedPerson ?? ""} /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Response time</span><input className="a-fld" name="retainerResponseTime" defaultValue={p.project.retainerResponseTime ?? ""} /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Handover document link</span><input className="a-fld" name="handoverDocUrl" defaultValue={p.project.handoverDocUrl ?? ""} /></label>
          </div>
          <div className="grid2">
            <label className="stack" style={{ gap: 6 }}><span className="lbl">The number we measure</span><input className="a-fld" name="metricName" defaultValue={p.project.metricName ?? ""} placeholder="Checkout completion rate" /></label>
            <label className="stack" style={{ gap: 6 }}><span className="lbl">Where it stands today</span><input className="a-fld" name="metricBaselineValue" defaultValue={p.project.metricBaselineValue ?? p.suggestedMetric} /></label>
          </div>
          {p.suggestedMetric && !p.project.metricBaselineValue && <p className="help">Prefilled from what they answered in the questionnaire.</p>}
        </div>

        {state.message && <p className="help err">{state.message}</p>}
        {state.ok && <p className="help">{state.ok}</p>}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="a-btn ghost" type="submit" name="intent" value="save" disabled={pending}>{pending ? "Saving" : "Save the draft"}</button>
          <button className="a-btn" type="submit" name="intent" value="send" disabled={pending || !p.canSend}>Send it to the client</button>
          {!p.canSend && <span className="help">Sending needs a submitted questionnaire and a project still in draft.</span>}
        </div>
      </div>

      <div className="aside">
        <div className="a-card ember">
          <span className="k ember">Never shown to the client</span>
          <p className="c-sub" style={{ fontSize: 13.5 }}>
            Nothing in this block reaches any client page, the printable agreement, the invoice, an export or a WhatsApp message. It is stripped by the serializer, not by remembering.
          </p>
          <label className="stack" style={{ gap: 6 }}><span className="lbl">What it costs us, in rupees</span><input className="a-fld" name="internalCost" defaultValue={rupees(p.internalCostPaise)} inputMode="decimal" /></label>
          <label className="stack" style={{ gap: 6 }}><span className="lbl">Internal notes</span><textarea className="a-fld" name="internalNotes" rows={6} defaultValue={p.view?.internalNotes ?? ""} /></label>
          {p.view && <p className="help">Margin as it stands: {p.view.total} less {p.view.internalCost}.</p>}
        </div>
      </div>
    </form>
  );
}
