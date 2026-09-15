import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Fold } from "@/components/ui/Fold";
import { bookingLink } from "@/lib/booking";
import { dayMonth } from "@/lib/dates";
import { requireAdmin } from "@/modules/auth/admin";
import { withProjects } from "@/modules/clients";
import { requestsFor, stateOf } from "@/modules/intake/changes";
import { intakeProgress } from "@/modules/intake/progress";
import { versionsFor } from "@/modules/intake/versions";
import { company } from "@/modules/settings";
import { PHASE_LABEL } from "@/modules/projects/phase";
import { questionnaireOpenMessage, waLink } from "@/lib/whatsapp";
import { updateClientAction } from "../../actions";
import { declineChangeAction, lockAgainAction, openChangesAction } from "./intake/changeActions";

/**
 * A client, before and after there is a project (ADR 0015, Q12). The loud
 * action follows the questionnaire: send it, then wait for it, then start the
 * project once it is in. Nothing on this page starts a project by itself.
 * The explanations of how the link and the codes work sit in one closed fold
 * (F-26); the details form is a fold whose summary shows the contact (F-27).
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
  // ADR 0016: once sent, the questionnaire is locked; this card is where the
  // team opens it, declines, or locks it again.
  const [requests, versions] = intake ? await Promise.all([requestsFor(client.id), versionsFor(client.id)]) : [[], []];
  const state = intake ? stateOf(intake, requests) : { kind: "open" as const };
  const firstName = client.contactName.split(" ")[0] ?? client.contactName;
  // Booking a meeting with this client, from here (Ayush, 15 Sep). The same
  // link the client has, with their name and email already on it, so a slot
  // picked on this side puts the invite in their inbox. Hidden, not broken,
  // while settings has no booking link.
  const c = await company();
  const book = c.bookingUrl?.trim() ? bookingLink(c.bookingUrl.trim(), client.contactName, client.contactEmail) : null;

  return (
    <AdminShell active="clients" adminName={admin.name}>
      <div className="a-head">
        <div className="stack" style={{ gap: 6 }}>
          <h1 className="a-title">{client.businessName}</h1>
          <p className="a-sub">Added {dayMonth(client.createdAt)}{client.location ? ` · ${client.location}` : ""} · {client.contactName}</p>
        </div>
        {/* Top right, the same slot the project page keeps for ending a
            project: outlined, because the loud action on this page is the
            questionnaire's or the project's, and this must not argue with it. */}
        {book && (
          <div className="a-head-act">
            <a className="a-btn ghost" href={book} target="_blank" rel="noopener">Book a meeting</a>
          </div>
        )}
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
                <Link className="a-btn ghost" href={`/admin/clients/${client.id}/intake/upload`}>Upload new JSON</Link>
              </div>
            </div>
          )}

          {intake && submitted && (
            <div className={`a-card${state.kind === "asked" ? " ember" : ""}`}>
              <div className="between">
                <span className={`k${state.kind === "asked" ? " ember" : ""}`}>
                  {state.kind === "asked" ? "The questionnaire, they asked to change it" : state.kind === "changing" ? "The questionnaire, open for changes" : "The questionnaire"}
                </span>
                <span className="mono-sm">{intake.submittedAt ? `Sent ${dayMonth(intake.submittedAt)}` : "Overridden"}{versions.length > 1 ? `, version ${versions.length} on ${dayMonth(versions[versions.length - 1].sentAt)}` : ""}</span>
              </div>

              {state.kind === "asked" && (
                <>
                  <p className="c-sub" style={{ fontSize: 14, color: "var(--ink)" }}>{firstName} asked on {dayMonth(state.request.askedAt)}: &ldquo;{state.request.note}&rdquo;</p>
                  <div className="stack" style={{ gap: 10 }}>
                    <form action={openChangesAction}>
                      <input type="hidden" name="clientId" value={client.id} />
                      <input type="hidden" name="requestId" value={state.request.id} />
                      <button className="a-btn" type="submit">Open it for them</button>
                    </form>
                    <form action={declineChangeAction} className="stack" style={{ gap: 8 }}>
                      <input type="hidden" name="clientId" value={client.id} />
                      <input type="hidden" name="requestId" value={state.request.id} />
                      <label className="stack" style={{ gap: 6 }}>
                        <span className="lbl">Or decline, with the line they will read</span>
                        <input className="a-fld" name="reply" placeholder="Why not, in a line. They read this." required />
                      </label>
                      <div><button className="a-btn ghost" type="submit">Decline with that line</button></div>
                    </form>
                  </div>
                  <p className="help">Opening it lets them change answers until they press Send the changes; then it locks again and what changed is marked. Declining keeps it locked and shows them your line. They can ask again.</p>
                </>
              )}

              {state.kind === "changing" && (
                <>
                  <p className="c-sub" style={{ fontSize: 14 }}>
                    Open since {dayMonth(state.request.decidedAt ?? state.request.askedAt)}
                    {state.request.askedBy === "CLIENT" ? <>, as they asked: &ldquo;{state.request.note}&rdquo;</> : state.request.note ? `: ${state.request.note}` : ", opened by us"}. It locks again when they press Send the changes, or when you lock it here.
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <a className="a-btn" href={waLink(client.contactPhone, questionnaireOpenMessage({ contactName: firstName, asked: state.request.askedBy === "CLIENT" }))} target="_blank" rel="noopener">Tell them on WhatsApp</a>
                    <form action={lockAgainAction}>
                      <input type="hidden" name="clientId" value={client.id} />
                      <button className="a-btn ghost" type="submit">Lock it again</button>
                    </form>
                  </div>
                </>
              )}

              {state.kind === "locked" && (
                <p className="help">Locked. To change an answer, {firstName} asks from their own page, and it turns up here for you to open or decline.</p>
              )}
              {state.kind === "locked" && state.declined && (
                <p className="help">Declined on {dayMonth(state.declined.decidedAt ?? state.declined.askedAt)}, to &ldquo;{state.declined.note}&rdquo;: {state.declined.reply}</p>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--rule-soft)", paddingTop: 14 }}>
                <Link className="a-btn ghost" href={`/admin/clients/${client.id}/intake`}>What they told us{versions.length > 1 ? `, ${versions.length} versions` : ""}</Link>
                <a className="a-btn ghost" href={`/admin/clients/${client.id}/intake/answers.json`}>Download JSON</a>
                <Link className="a-btn ghost" href={`/admin/clients/${client.id}/intake/upload`}>Upload new JSON</Link>
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

          <Fold card title="Client details" fact={`${client.contactName} · ${client.contactPhone}`}>
            <form action={updateClientAction} className="stack" style={{ gap: 14 }}>
              <input type="hidden" name="clientId" value={client.id} />
              <div className="grid2">
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Business name</span><input className="a-fld" name="businessName" defaultValue={client.businessName} required /></label>
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Where they are</span><input className="a-fld" name="location" defaultValue={client.location ?? ""} /></label>
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Contact name</span><input className="a-fld" name="contactName" defaultValue={client.contactName} required /></label>
                <label className="stack" style={{ gap: 6 }}><span className="lbl">WhatsApp number, with the country code</span><input className="a-fld" name="contactPhone" defaultValue={client.contactPhone} placeholder="+91 99000 21188" required /></label>
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Contact email, where the login code goes</span><input className="a-fld" name="contactEmail" type="email" defaultValue={client.contactEmail} required /></label>
              </div>
              <div><button className="a-btn ghost" type="submit">Save changes</button></div>
            </form>
          </Fold>
        </div>

        <div className="aside">
          <div className={`a-card${client.linkEmailError ? " ember" : ""}`}>
            <span className={`k${client.linkEmailError ? " ember" : ""}`}>Their link</span>
            <p className="help" style={{ lineHeight: 1.6 }}>
              {client.linkEmailedAt ? `Emailed ${dayMonth(client.linkEmailedAt)}.` : client.linkEmailError ? "The email did not go out." : "Not emailed yet; it goes with the questionnaire."}
              {" "}No password exists: the link is the way in, and a code confirms each device.
            </p>
            <div><Link className="a-btn ghost" href={`/admin/clients/${client.id}/link`}>The link, and how to send it</Link></div>
          </div>

          <Fold card title="Who says yes" ember={Boolean(client.proposedSignoffEmail)} open={Boolean(client.proposedSignoffEmail)} fact={client.proposedSignoffName ?? client.contactName}>
            {client.proposedSignoffEmail ? (
              <>
                <p style={{ margin: 0, fontSize: 14 }}>{client.proposedSignoffName ?? "Unnamed"}</p>
                <p className="mono-sm" style={{ margin: 0 }}>{client.proposedSignoffEmail}</p>
                <p className="help">Named on the questionnaire. Offered first when you start a project; the sign-off codes go there.</p>
              </>
            ) : (
              <p className="c-sub" style={{ fontSize: 14 }}>Asked on the questionnaire and set per project, so a brand job and a store rebuild can have different approvers. Until then, {client.contactName}.</p>
            )}
          </Fold>

          <Fold card title="How they get in">
            <p className="help" style={{ lineHeight: 1.9 }}>
              One link per client, which does not expire.<br />
              A six digit code to {client.contactEmail} the first time on each device.<br />
              Thirty days signed in on that device.<br />
              A fresh code to the sign-off person for each sign-off.
            </p>
            <p className="help" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 12, lineHeight: 1.65 }}>
              If they ask you for a password, the answer is that there is not one and there never was.
            </p>
          </Fold>
        </div>
      </div>
    </AdminShell>
  );
}
