import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { dayMonth } from "@/lib/dates";
import { requireAdmin } from "@/modules/auth/admin";
import { withProjects } from "@/modules/clients";
import { intakeProgress } from "@/modules/intake/progress";
import { PHASE_LABEL } from "@/modules/projects/phase";
import { updateClientAction } from "../../actions";

/**
 * A client, before and after there is a project (ADR 0015, Q12). The loud
 * action follows the questionnaire: send it, then wait for it, then start the
 * project once it is in. Nothing on this page starts a project by itself.
 */
export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const client = await withProjects(id);
  if (!client) notFound();

  const intake = client.intake;
  const progress = intake ? intakeProgress(intake.document, intake.answers, intake.sectionsDone) : null;
  const submitted = Boolean(intake?.submittedAt || intake?.overriddenAt);
  const live = client.projects.filter((p) => p.phase !== "CLOSED" && p.phase !== "CANCELLED");

  return (
    <AdminShell active="clients" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="a-title">{client.businessName}</h1>
        <p className="a-sub">Added {dayMonth(client.createdAt)}{client.location ? ` · ${client.location}` : ""} · {client.contactName}</p>
      </div>

      <div className="a-cols">
        <div className="main">
          {!intake && (
            <div className="a-card ember">
              <span className="k ember">The questionnaire</span>
              <p className="c-sub" style={{ fontSize: 14 }}>
                Nothing is on their page yet. Sending the questionnaire puts the first thing there and emails them their link.
              </p>
              <div><Link className="a-btn" href={`/admin/clients/${client.id}/intake/upload`}>Send the questionnaire</Link></div>
            </div>
          )}

          {intake && progress && !submitted && (
            <div className="a-card ember">
              <div className="between">
                <span className="k ember">The questionnaire, open</span>
                <span className="mono-sm">{progress.done} of {progress.total} sections{intake.lastSavedAt ? `, saved ${dayMonth(intake.lastSavedAt)}` : ""}</span>
              </div>
              <p className="c-sub" style={{ fontSize: 14 }}>Sent {dayMonth(intake.documentUploadedAt)}. Waiting on them. The agreement cannot go until this is in, or until you override it on the project.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link className="a-btn ghost" href={`/admin/clients/${client.id}/intake`}>What they have said so far</Link>
                <Link className="a-btn ghost" href={`/admin/clients/${client.id}/intake/fill`}>Type answers from a call</Link>
                <Link className="a-btn ghost" href={`/admin/clients/${client.id}/intake/upload`}>Replace the document</Link>
              </div>
            </div>
          )}

          {intake && submitted && (
            <div className="a-card">
              <div className="between">
                <span className="k">The questionnaire</span>
                <span className="mono-sm">{intake.submittedAt ? `Submitted ${dayMonth(intake.submittedAt)}` : "Overridden"}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link className="a-btn ghost" href={`/admin/clients/${client.id}/intake`}>What they told us</Link>
                <a className="a-btn ghost" href={`/admin/clients/${client.id}/intake/answers.json`}>Download answers JSON</a>
              </div>
            </div>
          )}

          <div className={`a-card${submitted && live.length === 0 ? " ember" : ""}`}>
            <div className="between">
              <span className={`k${submitted && live.length === 0 ? " ember" : ""}`}>Projects</span>
              <Link className="a-btn" href={`/admin/clients/${client.id}/projects/new`}>{client.projects.length ? "Start another" : "Start a project"}</Link>
            </div>
            {client.projects.length === 0 && (
              <p className="c-sub" style={{ fontSize: 14 }}>
                {submitted ? "Their answers are in. Starting the project puts the agreement on their page." : "None yet. Send the questionnaire first; the project comes after."}
              </p>
            )}
            <div className="stack">
              {client.projects.map((p) => (
                <div key={p.id} className="between" style={{ padding: "11px 0", borderBottom: "1px solid var(--rule-soft)" }}>
                  <span className="stack" style={{ gap: 3 }}>
                    <Link href={`/admin/projects/${p.id}`} className="sec-name" style={{ fontSize: 14.5, textDecoration: "none" }}>{p.name}</Link>
                    <span className="help">{PHASE_LABEL[p.phase]} · signs off {p.signoffPersonName}</span>
                  </span>
                  <span className="mono-sm">{dayMonth(p.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="a-card">
            <span className="k">Details</span>
            <form action={updateClientAction} className="stack" style={{ gap: 14 }}>
              <input type="hidden" name="clientId" value={client.id} />
              <div className="grid2">
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Business name</span><input className="a-fld" name="businessName" defaultValue={client.businessName} required /></label>
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Where they are</span><input className="a-fld" name="location" defaultValue={client.location ?? ""} /></label>
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Contact name</span><input className="a-fld" name="contactName" defaultValue={client.contactName} required /></label>
                <label className="stack" style={{ gap: 6 }}><span className="lbl">WhatsApp number</span><input className="a-fld" name="contactPhone" defaultValue={client.contactPhone} required /></label>
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Contact email, where the login code goes</span><input className="a-fld" name="contactEmail" type="email" defaultValue={client.contactEmail} required /></label>
              </div>
              <div><button className="a-btn ghost" type="submit">Save changes</button></div>
            </form>
          </div>
        </div>

        <div className="aside">
          <div className={`a-card${client.linkEmailError ? " ember" : ""}`}>
            <span className={`k${client.linkEmailError ? " ember" : ""}`}>Their link</span>
            <p className="help" style={{ lineHeight: 1.6 }}>
              One link, made when they were added, and it does not expire. Every project appears on it.
              {client.linkEmailedAt ? ` Emailed ${dayMonth(client.linkEmailedAt)}.` : client.linkEmailError ? " The email did not go out." : " Not emailed yet; it goes with the questionnaire."}
            </p>
            <div><Link className="a-btn ghost" href={`/admin/clients/${client.id}/link`}>The link, and how to send it</Link></div>
          </div>
          <div className={`a-card${client.proposedSignoffEmail ? " ember" : ""}`}>
            <span className="k">Who says yes</span>
            {client.proposedSignoffEmail ? (
              <>
                <p style={{ margin: 0, fontSize: 14 }}>{client.proposedSignoffName ?? "Unnamed"}</p>
                <p className="mono-sm" style={{ margin: 0 }}>{client.proposedSignoffEmail}</p>
                <p className="help">Named on the questionnaire. Offered first when you start a project; the sign-off codes go there.</p>
              </>
            ) : (
              <p className="c-sub" style={{ fontSize: 14 }}>Asked on the questionnaire and set per project, so a brand job and a store rebuild can have different approvers. Until then, {client.contactName}.</p>
            )}
          </div>
          <div className="a-card">
            <span className="k">How they get in</span>
            <p className="help" style={{ lineHeight: 1.9 }}>
              One link per client, which does not expire.<br />
              A six digit code to {client.contactEmail} the first time on each device.<br />
              Thirty days signed in on that device.<br />
              A fresh code to the sign-off person for each sign-off.
            </p>
            <p className="help" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 12, lineHeight: 1.65 }}>
              No password exists. If they ask you for one, the answer is that there is not one and there never was.
            </p>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
