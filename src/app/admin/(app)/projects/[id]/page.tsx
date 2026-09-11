import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/modules/auth/admin";
import { dayMonth, dayMonthTime } from "@/lib/format";
import { intakeProgress } from "@/modules/intake/progress";
import { parseDocumentLoose } from "@/modules/intake/document";
import { PHASE_LABEL } from "@/modules/projects/phase";
import { agreementToAdminView, invoiceToClientView } from "@/modules/serializers";
import { isoDate } from "@/lib/dates";
import { Phase } from "@/generated/prisma/enums";
import { RecordWhatsapp } from "./whatsapp/RecordWhatsapp";
import { markKickoffAction } from "./updates/actions";
import { agreementReadyMessage, day30Message, invoiceIssuedMessage, readyForReviewMessage, waLink } from "@/lib/whatsapp";
import { deliverableCount, roundsForProject } from "@/modules/review";
import { forProject as day30For, isUnlocked as day30Unlocked, referralsForAdmin, testimonialsForAdmin } from "@/modules/day30";
import { testimonialToAdminView } from "@/modules/serializers";
import { MarkReady } from "./review/MarkReady";
import { MarkPaid, RaiseOther } from "./invoices/InvoiceControls";
import { forProject } from "@/modules/invoices";
import { agreementNoteCount, forAdmin, signoffsForAdmin } from "@/modules/projects";
import { forProject as updatesForProject } from "@/modules/updates";
import { company } from "@/modules/settings";
import { forgetReferralAction } from "./review/actions";
import { approveTestimonialAction, closeProjectAction, saveFrictionNotesAction } from "./day30/actions";
import { CancelProject } from "./day30/CancelProject";
import { signoffDecisionAction, updateSignoffAction } from "../../actions";

const TYPE_LABEL: Record<string, string> = { STORE: "Store", APP: "App", SAAS: "SaaS", MARKETING: "Marketing", BRAND: "Brand" };

export default async function ProjectAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const project = await forAdmin(id);
  if (!project) notFound();
  const co = await company();
  const [invoices, signoffs, noteCount, updates, rounds, testimonialRows, referrals, day30] = await Promise.all([
    forProject(id),
    signoffsForAdmin(id),
    agreementNoteCount(id),
    updatesForProject(id),
    roundsForProject(id),
    testimonialsForAdmin(id),
    referralsForAdmin(id),
    day30For(id),
  ]);
  const agreement = project.agreement ? agreementToAdminView(project.agreement) : null;
  const testimonials = testimonialRows.map(testimonialToAdminView);
  const openRound = rounds.find((r) => r.outcome === "OPEN") ?? null;
  const latestStaging = updates.find((u) => u.stagingUrl)?.stagingUrl ?? "";
  const c = project.client;
  const intake = project.client.intake;
  const doc = intake ? parseDocumentLoose(intake.document) : null;
  const progress = intake ? intakeProgress(intake.document, intake.answers, intake.sectionsDone) : null;
  const ended = project.phase === Phase.CANCELLED || project.phase === Phase.CLOSED;
  const answers = intake && intake.answers && typeof intake.answers === "object" ? (intake.answers as Record<string, { entered_by?: string }>) : {};
  const byClient = Object.values(answers).filter((a) => a.entered_by !== "team").length;
  const byTeam = Object.values(answers).length - byClient;

  return (
    <AdminShell active="projects" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="a-title">{project.name}</h1>
        <p className="a-sub">{c.businessName} · {TYPE_LABEL[project.typeOfWork]} · {PHASE_LABEL[project.phase]} · created {dayMonth(project.createdAt)}</p>
      </div>
      <div className="a-cols">
        <div className="main">
          {ended && (
            <div className="a-card">
              <span className="k">{project.phase === Phase.CANCELLED ? "Cancelled" : "Closed"}</span>
              <p className="c-sub" style={{ fontSize: 14 }}>
                This project was {project.phase === Phase.CANCELLED ? "cancelled" : "closed"}{project.cancelledAt ? ` on ${dayMonth(project.cancelledAt)}` : ""}.
                {project.phase === Phase.CANCELLED && project.cancelReason ? ` Why, ours only: ${project.cancelReason}` : ""}
              </p>
              <p className="help">Nothing new is raised or written from here. Everything below is the record, as it stood. The client page says it was closed, with the date.</p>
            </div>
          )}
          <div className={`a-card${project.phase === "AGREEMENT_DRAFT" ? " ember" : ""}`}>
            <div className="between">
              <span className={`k${project.phase === "AGREEMENT_DRAFT" ? " ember" : ""}`}>The agreement</span>
              {agreement && <span className="mono-sm">{agreement.isAgreed ? `Agreed by ${agreement.agreedByName} on ${agreement.agreedAt}` : agreement.sentAt ? `Sent, version ${agreement.version}` : "Draft"}</span>}
            </div>
            {!agreement && <p className="c-sub" style={{ fontSize: 14 }}>Not written yet. It is the one page the client agrees to, once.</p>}
            {agreement && (
              <div className="stack">
                <div className="between" style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}><span>{agreement.deliverables.length} deliverables, each with how the client checks it</span><span className="mono-sm">{agreement.total}</span></div>
                <div className="between" style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}><span>Advance {agreement.advancePct} percent</span><span className="mono-sm">{agreement.advance} then {agreement.balance}</span></div>
                <div className="between" style={{ padding: "9px 0" }}><span>Internal cost, never shown to the client</span><span className="mono-sm" style={{ color: "var(--ember)" }}>{agreement.internalCost}</span></div>
              </div>
            )}
            {noteCount > 0 && <p className="help" style={{ color: "var(--ember)" }}>{noteCount} {noteCount === 1 ? "note" : "notes"} from the client on what was off.</p>}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {ended
                ? agreement && <Link className="a-btn ghost" href={`/admin/projects/${project.id}/agreement`}>Read the agreement</Link>
                : <Link className="a-btn" href={`/admin/projects/${project.id}/agreement`}>{agreement ? (agreement.isAgreed ? "Read the agreement" : "Edit and send") : "Write the agreement"}</Link>}
              {agreement?.sentAt && <a className="a-btn ghost" href={`/agreement/${project.id}/print`} target="_blank" rel="noopener">Print view</a>}
              {project.phase === "AGREEMENT_SENT" && (
                <a
                  className="a-btn ghost"
                  href={waLink(c.contactPhone, agreementReadyMessage({ contactName: c.contactName.trim().split(/\s+/)[0] || c.contactName, projectName: project.name }))}
                  target="_blank"
                  rel="noopener"
                >
                  Tell them on WhatsApp
                </a>
              )}
            </div>
          </div>

          {project.phase === Phase.AGREED && (
            <div className="a-card ember">
              <span className="k ember">The one thing that moves this on</span>
              <p className="c-sub" style={{ fontSize: 14 }}>
                They have agreed and the advance is raised. Marking the kickoff done starts the build, and the weekly updates with it.
              </p>
              <form action={markKickoffAction}>
                <input type="hidden" name="projectId" value={project.id} />
                <button className="a-btn" type="submit">Kickoff is done, start the build</button>
              </form>
            </div>
          )}

          {(project.phase === Phase.BUILDING || updates.length > 0) && (
            <div className="a-card">
              <div className="between">
                <span className="k">Weekly updates</span>
                <Link className="a-btn" href={`/admin/projects/${project.id}/updates`}>
                  {updates.length === 0 ? "Write the first one" : "Write this week"}
                </Link>
              </div>
              {updates.length === 0 && <p className="c-sub" style={{ fontSize: 14 }}>None yet. One a week, whether or not anything went wrong.</p>}
              <div className="stack">
                {updates.map((u) => (
                  <div className="between" key={u.id} style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}>
                    <Link className="mono-sm" href={`/admin/projects/${project.id}/updates?week=${u.weekNumber}`} style={{ color: "var(--muted)" }}>
                      Week {u.weekNumber}
                    </Link>
                    <span className="help">{u.sentAt ? `sent ${dayMonth(u.sentAt)}` : "draft, the client cannot see it"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {project.phase === Phase.BUILDING && agreement?.isAgreed && (
            <MarkReady projectId={project.id} suggestedUrl={latestStaging} />
          )}

          {rounds.length > 0 && (
            <div className={`a-card${openRound ? " ember" : ""}`}>
              <div className="between">
                <span className={`k${openRound ? " ember" : ""}`}>Review rounds</span>
                {openRound && agreement && (
                  <a
                    className="a-btn ghost"
                    href={waLink(c.contactPhone, readyForReviewMessage({
                      contactName: c.contactName.trim().split(/\s+/)[0] || c.contactName,
                      projectName: project.name,
                      deliverableCount: deliverableCount(project.agreement?.deliverables),
                      link: openRound.finishedWorkUrl,
                    }))}
                    target="_blank"
                    rel="noopener"
                  >
                    Tell them on WhatsApp
                  </a>
                )}
              </div>
              <div className="stack">
                {rounds.map((r) => (
                  <div className="row" key={r.id}>
                    <div className="between" style={{ alignItems: "baseline" }}>
                      <span className="lbl">Round {r.roundNumber}, sent {dayMonth(r.sentAt)}</span>
                      <span className="tag" style={{ color: r.outcome === "OPEN" ? "var(--ember)" : "var(--muted)" }}>
                        {r.outcome === "OPEN" ? "with the client" : r.outcome === "ACCEPTED" ? "signed off" : "changes requested"}
                      </span>
                    </div>
                    {r.clientNote && <p style={{ margin: 0, fontSize: 14.5, whiteSpace: "pre-wrap" }}>{r.clientNote}</p>}
                    <a className="mono-sm" href={r.finishedWorkUrl} target="_blank" rel="noopener">{r.finishedWorkUrl}</a>
                  </div>
                ))}
              </div>
              <p className="help">Every round is kept. Nothing here edits or removes one.</p>
            </div>
          )}

          {project.phase === Phase.IN_REVIEW && (
            <RecordWhatsapp
              projectId={project.id}
              suggestedName={project.signoffPersonName}
              today={isoDate(new Date())}
              kind="DELIVERY"
            />
          )}

          {day30 && (
            <div className="a-card">
              <span className="k">Day 30</span>
              <p className="c-sub" style={{ fontSize: 14 }}>
                {day30.metricAfterSubmittedAt
                  ? `Answered on ${dayMonth(day30.metricAfterSubmittedAt)}.`
                  : day30Unlocked(day30)
                    ? `Open since ${dayMonth(day30.unlocksAt)}. ${day30.openedAt ? `Seen on ${dayMonth(day30.openedAt)}, not answered.` : "Not opened yet."}`
                    : `Opens on ${dayMonth(day30.unlocksAt)}.`}
              </p>

              {project.metricName && (
                <p className="help">
                  {project.metricName}: {project.metricBaselineValue ?? "no baseline"} at the start
                  {day30.metricAfterValue ? `, ${day30.metricAfterValue} now` : ", nothing back yet"}.
                </p>
              )}

              {day30Unlocked(day30) && !day30.metricAfterSubmittedAt && (
                <a
                  className="mono-sm"
                  href={waLink(c.contactPhone, day30Message({
                    contactName: c.contactName.trim().split(/\s+/)[0] || c.contactName,
                    projectName: project.name,
                    metricName: project.metricName,
                  }))}
                  target="_blank"
                  rel="noopener"
                >
                  Nudge them on WhatsApp
                </a>
              )}

              <form action={saveFrictionNotesAction} className="stack" style={{ gap: 8, paddingTop: 10, borderTop: "1px solid var(--rule-soft)" }}>
                <input type="hidden" name="projectId" value={project.id} />
                <span className="lbl">Friction notes, never shown to the client</span>
                <textarea className="a-fld" name="frictionNotes" rows={3} defaultValue={day30.frictionNotes} placeholder="What was harder than it should have been" />
                <div><button className="a-btn ghost" type="submit">Save the notes</button></div>
              </form>

              {project.phase === Phase.DELIVERED && (
                <form action={closeProjectAction} style={{ paddingTop: 8, borderTop: "1px solid var(--rule-soft)" }}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <button className="link-mono" type="submit" style={{ padding: 0 }}>Close this project</button>
                  <p className="help" style={{ paddingTop: 4 }}>The record stays readable at the same link. Nothing else changes.</p>
                </form>
              )}
            </div>
          )}

          {testimonials.length > 0 && (
            <div className="a-card">
              <span className="k">What they said</span>
              <div className="stack">
                {testimonials.map((t) => (
                  <div className="row" key={t.id}>
                    <div className="between" style={{ alignItems: "baseline" }}>
                      <span className="lbl">{t.momentLabel}, {t.createdAt}</span>
                      <span className="tag" style={{ color: t.status === "APPROVED" ? "var(--muted)" : "var(--ember)" }}>
                        {t.status === "APPROVED" ? "approved" : "draft, not for use"}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 14.5, whiteSpace: "pre-wrap" }}>{t.text}</p>
                    {t.status !== "APPROVED" && (
                      <form action={approveTestimonialAction} style={{ paddingTop: 6 }}>
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="moment" value={t.moment} />
                        <button className="link-mono" type="submit" style={{ padding: 0 }}>They said yes on WhatsApp, approve it</button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
              <p className="help">A draft is theirs, not ours. It appears nowhere outside this page until they approve it at day 30.</p>
            </div>
          )}

          {referrals.length > 0 && (
            <div className="a-card">
              <span className="k">Someone they named</span>
              <div className="stack">
                {referrals.map((r) => (
                  <div className="between" key={r.id} style={{ padding: "11px 0", borderBottom: "1px solid var(--rule-soft)" }}>
                    <span className="stack" style={{ gap: 3 }}>
                      <span style={{ fontSize: 14.5 }}>{r.name}</span>
                      <span className="mono-sm">{r.contact}</span>
                    </span>
                    <form action={forgetReferralAction}>
                      <input type="hidden" name="referralId" value={r.id} />
                      <button className="link-mono" type="submit" style={{ padding: 0, fontSize: "10.5px" }}>Forget them</button>
                    </form>
                  </div>
                ))}
              </div>
              <p className="help" style={{ lineHeight: 1.65 }}>
                Shown here and nowhere else: not on any client page, not in an export, not in a WhatsApp message. This is the one record in the system that can be deleted, because it holds someone else&rsquo;s details and they never agreed to be here.
              </p>
            </div>
          )}

          {project.phase !== Phase.DELIVERED && project.phase !== Phase.CLOSED && project.phase !== Phase.CANCELLED && (
            <div className="a-card">
              <span className="k">Ending it early</span>
              <CancelProject projectId={project.id} />
            </div>
          )}

          {project.phase === Phase.AGREEMENT_SENT && (
            <RecordWhatsapp
              projectId={project.id}
              suggestedName={project.signoffPersonName}
              today={isoDate(new Date())}
              kind="AGREEMENT"
            />
          )}

          {/* Always here. An extra invoice is a real document whether or not
              anything has been agreed yet, and hiding the control behind the
              agreement was an accident of where it was put. */}
            <div className="a-card">
              <span className="k">Invoices</span>
              {invoices.length === 0 && <p className="c-sub" style={{ fontSize: 14 }}>None yet. The advance follows the agreement, the balance follows the delivery.</p>}
              <div className="stack">
                {invoices.map((raw) => {
                  const i = invoiceToClientView(raw);
                  return (
                    <div className="row" key={i.id}>
                      <div className="between">
                        <span className="stack" style={{ gap: 2 }}>
                          <a className="mono-sm" href={`/invoice/${i.id}/print`} target="_blank" rel="noopener" style={{ color: "var(--ink)" }}>{i.number}</a>
                          <span className="help">{i.kindLabel} · {i.issuedAt}</span>
                      {i.kind === "OTHER" && <span className="help" style={{ color: "var(--ink)" }}>{i.description}</span>}
                        </span>
                        <span className="stack" style={{ gap: 2, alignItems: "flex-end" }}>
                          <span className="mono-sm" style={{ color: "var(--ink)" }}>{i.total}</span>
                          <span className="tag" style={{ color: i.status === "PAID" ? "var(--muted)" : "var(--ember)" }}>
                            {i.statusLabel}{i.paidAt ? ` ${i.paidAt}` : ""}
                          </span>
                        </span>
                      </div>
                      {i.status === "ISSUED" && <MarkPaid invoice={i} projectId={project.id} today={isoDate(new Date())} />}
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 6 }}>
                        <a className="mono-sm" href={`/invoice/${i.id}/print`} target="_blank" rel="noopener">Print view</a>
                        <a
                          className="mono-sm"
                          href={waLink(c.contactPhone, invoiceIssuedMessage({
                            contactName: c.contactName.trim().split(/\s+/)[0] || c.contactName,
                            number: i.number,
                            amount: i.total,
                            kindLabel: i.kindLabel,
                          }))}
                          target="_blank"
                          rel="noopener"
                        >
                          Tell them on WhatsApp
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!co.bankAccountNumber && !co.upiId && (
                <p className="help err">
                  No bank details in <Link href="/admin/settings">settings</Link>, so a printed invoice has nowhere to pay it.
                </p>
              )}
              {!ended && <RaiseOther projectId={project.id} />}
              <p className="help">Raised by a sign-off and by nothing else, apart from an extra. An issued invoice keeps its number, and only its payment moves.</p>
            </div>

          {signoffs.length > 0 && (
            <div className="a-card">
              <span className="k">Sign-offs</span>
              <div className="stack">
                {signoffs.map((s) => (
                  <div className="between" key={s.id} style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}>
                    <span>{s.kind === "AGREEMENT" ? "Agreement" : "Delivery"} by {s.actorName}</span>
                    <span className="mono-sm" style={{ color: s.method === "WHATSAPP" ? "var(--ember)" : "var(--muted)" }}>
                      {dayMonthTime(s.occurredAt)} · {s.method === "WHATSAPP" ? "recorded from WhatsApp" : "tapped in the portal"}
                    </span>
                  </div>
                ))}
              </div>
              {signoffs.some((s) => s.method === "WHATSAPP") && (
                <div className="stack">
                  {signoffs.filter((s) => s.method === "WHATSAPP" && s.rawNote).map((s) => (
                    <div className="row" key={`note-${s.id}`}>
                      <span className="lbl">What {s.actorName} sent</span>
                      <p style={{ margin: 0, fontSize: 14, whiteSpace: "pre-wrap", color: "var(--ink)" }}>{s.rawNote}</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="help">Append only, and the two ways in stay distinguishable forever. There is no path in the system that edits or deletes one.</p>
            </div>
          )}

          <div className={`a-card${intake && !intake.submittedAt ? " ember" : ""}`}>
            <div className="between">
              <span className={`k${intake && !intake.submittedAt ? " ember" : ""}`}>The questionnaire</span>
              {intake && progress && (
                <span className="mono-sm">
                  {intake.submittedAt ? `Submitted ${dayMonthTime(intake.submittedAt)}` : `Open, ${progress.done} of ${progress.total} sections${intake.lastSavedAt ? `, last saved ${dayMonthTime(intake.lastSavedAt)}` : ""}`}
                </span>
              )}
            </div>
            {!intake && (
              <>
                <p className="c-sub" style={{ fontSize: 14 }}>Not uploaded yet. The client sees &ldquo;nothing to do yet&rdquo; until it is.</p>
                <div><Link className="a-btn" href={`/admin/clients/${project.client.id}/intake/upload`}>Upload questionnaire</Link></div>
              </>
            )}
            {intake && doc && (
              <>
                <div className="stack">
                  <div className="between" style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}><span>Uploaded {dayMonth(intake.documentUploadedAt)} by {intake.documentUploadedBy.name}</span><span className="mono-sm">{doc.title}</span></div>
                  <div className="between" style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}><span>{doc.sections.length} sections, {doc.sections.reduce((n, s) => n + s.questions.length, 0)} questions, {doc.sections.find((s) => s.access_items)?.access_items?.length ?? 0} access items</span><span className="mono-sm">Passed every import rule</span></div>
                  <div className="between" style={{ padding: "9px 0" }}><span>Answers so far</span><span className="mono-sm">{byClient} by the client, {byTeam} by the team</span></div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link className="a-btn" href={`/admin/clients/${project.client.id}/intake`}>What they told us</Link>
                  <Link className="a-btn ghost" href={`/admin/clients/${project.client.id}/intake/upload`}>Replace the document</Link>
                  <a className="a-btn ghost" href={`/admin/clients/${project.client.id}/intake/answers.json`}>Download answers JSON</a>
                </div>
                <p className="help" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 12, lineHeight: 1.65 }}>Replacing after answers exist keeps every answer. Answers whose keys are gone are hidden, not deleted. There is no way to edit a question here. Change it in conversation and upload again.</p>
              </>
            )}
          </div>

          <div className="a-card">
            <div className="between"><span className="k">The client</span><Link className="mono-sm" href={`/admin/clients/${c.id}`}>Open the client</Link></div>
            <div className="stack">
              <div className="between" style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}><span>{c.businessName}</span><span className="mono-sm">{c.location ?? ""}</span></div>
              <div className="between" style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}><span>{c.contactName}</span><span className="mono-sm">{c.contactPhone}</span></div>
              <div className="between" style={{ padding: "9px 0" }}><span>{c.contactEmail}</span><span className="help">who we talk to day to day</span></div>
            </div>
            <p className="help">Their details are the same on every project, so they are edited on the client, not here.</p>
          </div>
        </div>

        <div className="aside">
          <div className="a-card">
            <span className="k">The client link</span>
            <p className="help" style={{ lineHeight: 1.6 }}>
              One link per client, and this project is on it. Created {dayMonth(project.client.tokenCreatedAt)}
              {project.client.tokenRotatedAt ? `, rotated ${dayMonth(project.client.tokenRotatedAt)}` : ""}.
              {project.client.linkEmailedAt ? ` Emailed to ${project.client.contactEmail} on ${dayMonth(project.client.linkEmailedAt)}.` : " Not emailed yet."}
            </p>
            <div><Link className="a-btn ghost" href={`/admin/clients/${project.client.id}/link`}>The link, and how to send it</Link></div>
          </div>

          <div className={`a-card${project.client.proposedSignoffEmail ? " ember" : ""}`}>
            <span className="k">Who signs off, on this project</span>
            <form action={updateSignoffAction} className="stack" style={{ gap: 10 }}>
              <input type="hidden" name="projectId" value={project.id} />
              <label className="stack" style={{ gap: 6 }}><span className="lbl">Name</span><input className="a-fld" name="signoffPersonName" defaultValue={project.signoffPersonName} required /></label>
              <label className="stack" style={{ gap: 6 }}><span className="lbl">Their email, where the code goes</span><input className="a-fld" name="signoffPersonEmail" type="email" defaultValue={project.signoffPersonEmail} required /></label>
              <div><button className="a-btn ghost" type="submit">Save</button></div>
            </form>
            <p className="help">Per project, not per client: a business can have a different approver for a brand job than for a store rebuild.</p>
            {project.client.proposedSignoffEmail && (
              <form action={signoffDecisionAction} className="stack" style={{ gap: 8, borderTop: "1px solid var(--rule-soft)", paddingTop: 12 }}>
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="clientId" value={project.client.id} />
                <span className="k ember">The client typed a different sign-off on the questionnaire</span>
                <p className="mono-sm" style={{ margin: 0, color: "var(--ink)" }}>{project.client.proposedSignoffName ? `${project.client.proposedSignoffName}, ` : ""}{project.client.proposedSignoffEmail}</p>
                <p className="help">Codes keep going to the address above until you switch it.</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="a-btn" name="decision" value="use" type="submit">Use the new one</button>
                  <button className="a-btn ghost" name="decision" value="keep" type="submit">Keep the old one</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
