import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Confirm } from "@/components/ui/Confirm";
import { Empty } from "@/components/ui/Empty";
import { Fold } from "@/components/ui/Fold";
import { requireAdmin } from "@/modules/auth/admin";
import { dayMonth, dayMonthTime } from "@/lib/format";
import { intakeProgress } from "@/modules/intake/progress";
import { parseDocumentLoose } from "@/modules/intake/document";
import { PHASE_LABEL } from "@/modules/projects/phase";
import { WAITING_LABEL, waitingOn } from "@/modules/projects/waiting";
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
import { approveTestimonialAction, cancelProjectAction, closeProjectAction, saveFrictionNotesAction } from "./day30/actions";
import { signoffDecisionAction, updateSignoffAction } from "../../actions";

const TYPE_LABEL: Record<string, string> = { STORE: "Store", APP: "App", SAAS: "SaaS", MARKETING: "Marketing", BRAND: "Brand" };

/**
 * The project, for the team. The line under the title says who it is waiting
 * on; the phase's one action is the only open ember card; the record sits in
 * folds that open where the phase makes them live (F-23). An ended project
 * shows the record and no form (F-25). Cancelling is a quiet link at the foot
 * that opens a confirm with the required reason (F-24).
 */
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
  const firstName = c.contactName.trim().split(/\s+/)[0] || c.contactName;
  const unpaid = invoices.filter((i) => i.status === "ISSUED").length;
  const waiting = waitingOn({
    phase: project.phase,
    createdAt: project.createdAt,
    intakeUploadedAt: intake?.documentUploadedAt ?? null,
    intakeSubmittedAt: intake?.submittedAt ?? null,
    agreementSentAt: project.agreement?.sentAt ?? null,
    agreementAgreedAt: project.agreement?.agreedAt ?? null,
    kickoffAt: project.kickoffAt,
    lastUpdateSentAt: updates.find((u) => u.sentAt)?.sentAt ?? null,
    openRoundSentAt: openRound?.sentAt ?? null,
    deliveredAt: project.deliveredAt,
    day30UnlocksAt: day30?.unlocksAt ?? null,
    day30AnsweredAt: day30?.metricAfterSubmittedAt ?? null,
  });

  return (
    <AdminShell active="projects" adminName={admin.name}>
      <div className="a-head">
        <div className="stack" style={{ gap: 6 }}>
          <h1 className="a-title">{project.name}</h1>
          <p className="a-sub">{c.businessName} · {TYPE_LABEL[project.typeOfWork]} · {PHASE_LABEL[project.phase]} · created {dayMonth(project.createdAt)}</p>
          {!ended && (
            <p className="a-sub" style={{ color: waiting.on === "client" ? "var(--ember)" : "var(--ink)" }}>
              Waiting on {WAITING_LABEL[waiting.on]}{waiting.on !== "nobody" ? ` for ${waiting.what}` : `: ${waiting.what}`}{waiting.since ? `, since ${dayMonth(waiting.since)}` : ""}.
            </p>
          )}
        </div>
        {/* Ending it: the same place on every project, at the top right under
            the header, whatever the phase (Ayush, 12 Sep). It stays a quiet
            link, because it must never compete with the phase's own card, and
            it asks before it acts. */}
        {!ended && (
          <div className="a-head-act">
            {project.phase === Phase.DELIVERED ? (
              <Confirm
                trigger="Close this project"
                triggerClass="a-btn ghost"
                title="Close this project?"
                line="The record stays readable at the same link, for you and for the client. Nothing else changes, and nothing is invoiced."
                confirmLabel="Close it"
                action={closeProjectAction}
              >
                <input type="hidden" name="projectId" value={project.id} />
              </Confirm>
            ) : (
              <Confirm
                trigger="Cancel this project"
                triggerClass="a-btn ghost"
                title="Cancel this project?"
                line="The client page will say it was closed, with the date. No invoice is created and no issued invoice changes. There is no way back from this."
                confirmLabel="Cancel the project"
                keepLabel="Keep it going"
                action={cancelProjectAction}
              >
                <input type="hidden" name="projectId" value={project.id} />
                <label className="stack" style={{ gap: 6 }}>
                  <span className="lbl">Why, in a line. Required, and only we ever read it.</span>
                  <input className="a-fld" name="reason" maxLength={500} required />
                </label>
              </Confirm>
            )}
          </div>
        )}
      </div>
      <div className="a-cols">
        <div className="main">
          {ended && (
            <div className="ended">
              <b>{project.phase === Phase.CANCELLED ? "Cancelled" : "Closed"}{project.cancelledAt ? ` on ${dayMonth(project.cancelledAt)}` : ""}</b>
              <p>
                {project.phase === Phase.CANCELLED && project.cancelReason ? `Why, ours only: ${project.cancelReason}. ` : ""}
                Nothing new is raised or written from here. Everything below is the record, as it stood. The client page says it was closed, with the date.
              </p>
            </div>
          )}

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

          {project.phase === Phase.BUILDING && agreement?.isAgreed && (
            <MarkReady projectId={project.id} suggestedUrl={latestStaging} />
          )}

          {project.phase === Phase.AGREEMENT_SENT && (
            <RecordWhatsapp projectId={project.id} suggestedName={project.signoffPersonName} today={isoDate(new Date())} kind="AGREEMENT" />
          )}

          {project.phase === Phase.IN_REVIEW && (
            <RecordWhatsapp projectId={project.id} suggestedName={project.signoffPersonName} today={isoDate(new Date())} kind="DELIVERY" />
          )}

          <Fold
            card
            title="The agreement"
            ember={project.phase === Phase.AGREEMENT_DRAFT}
            open={!ended && !agreement?.isAgreed}
            fact={agreement ? (agreement.isAgreed ? `agreed ${agreement.agreedAt}` : agreement.sentAt ? `sent, version ${agreement.version}` : "draft") : "not written yet"}
          >
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
              {project.phase === Phase.AGREEMENT_SENT && (
                <a className="a-btn ghost" href={waLink(c.contactPhone, agreementReadyMessage({ contactName: firstName, projectName: project.name }))} target="_blank" rel="noopener">
                  Tell them on WhatsApp
                </a>
              )}
            </div>
          </Fold>

          {(project.phase === Phase.BUILDING || updates.length > 0) && (
            <Fold card title="Weekly updates" open={project.phase === Phase.BUILDING} fact={updates.length === 0 ? "none yet" : `${updates.length}, last ${updates[0]?.sentAt ? `sent ${dayMonth(updates[0].sentAt)}` : "a draft"}`}>
              {!ended && (
                <div><Link className="a-btn" href={`/admin/projects/${project.id}/updates`}>{updates.length === 0 ? "Write the first one" : "Write this week"}</Link></div>
              )}
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
            </Fold>
          )}

          {rounds.length > 0 && (
            <Fold card title="Review rounds" ember={Boolean(openRound)} open={project.phase === Phase.IN_REVIEW} fact={openRound ? `with the client since ${dayMonth(openRound.sentAt)}` : `${rounds.length}, last ${rounds[rounds.length - 1]?.outcome === "ACCEPTED" ? "signed off" : "sent back"}`}>
              {openRound && agreement && (
                <div>
                  <a
                    className="a-btn ghost"
                    href={waLink(c.contactPhone, readyForReviewMessage({ contactName: firstName, projectName: project.name, deliverableCount: deliverableCount(project.agreement?.deliverables), link: openRound.finishedWorkUrl }))}
                    target="_blank"
                    rel="noopener"
                  >
                    Tell them on WhatsApp
                  </a>
                </div>
              )}
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
            </Fold>
          )}

          {/* Always here. An extra invoice is a real document whether or not
              anything has been agreed yet. */}
          <Fold card title="Invoices" open={unpaid > 0} fact={invoices.length === 0 ? "none yet" : unpaid === 0 ? `${invoices.length}, all paid` : `${unpaid} to pay`}>
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
                        href={waLink(c.contactPhone, invoiceIssuedMessage({ contactName: firstName, number: i.number, amount: i.total, kindLabel: i.kindLabel }))}
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
          </Fold>

          {signoffs.length > 0 && (
            <Fold card title="Sign-offs" open fact={signoffs.map((s) => (s.kind === "AGREEMENT" ? "agreement" : "delivery")).join(", ")}>
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
              {signoffs.some((s) => s.method === "WHATSAPP" && s.rawNote) && (
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
            </Fold>
          )}

          {day30 && (
            <Fold
              card
              title="Day 30"
              open={!ended && day30Unlocked(day30) && !day30.metricAfterSubmittedAt}
              fact={day30.metricAfterSubmittedAt ? `answered ${dayMonth(day30.metricAfterSubmittedAt)}` : day30Unlocked(day30) ? `open since ${dayMonth(day30.unlocksAt)}` : `opens ${dayMonth(day30.unlocksAt)}`}
            >
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
              {!ended && day30Unlocked(day30) && !day30.metricAfterSubmittedAt && (
                <div>
                  <a className="a-btn ghost" href={waLink(c.contactPhone, day30Message({ contactName: firstName, projectName: project.name, metricName: project.metricName }))} target="_blank" rel="noopener">
                    Nudge them on WhatsApp
                  </a>
                </div>
              )}
              {ended ? (
                day30.frictionNotes && (
                  <div className="row">
                    <span className="lbl">Friction notes, never shown to the client</span>
                    <p style={{ margin: 0, fontSize: 14, whiteSpace: "pre-wrap" }}>{day30.frictionNotes}</p>
                  </div>
                )
              ) : (
                <form action={saveFrictionNotesAction} className="stack" style={{ gap: 8, paddingTop: 10, borderTop: "1px solid var(--rule-soft)" }}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <label className="stack" style={{ gap: 6 }}>
                    <span className="lbl">Friction notes, never shown to the client</span>
                    <textarea className="a-fld" name="frictionNotes" rows={3} defaultValue={day30.frictionNotes} placeholder="What was harder than it should have been" />
                  </label>
                  <div><button className="a-btn ghost" type="submit">Save the notes</button></div>
                </form>
              )}
            </Fold>
          )}

          {testimonials.length > 0 && (
            <Fold card title="What they said" open fact={`${testimonials.length}, ${testimonials.filter((t) => t.status === "APPROVED").length} approved`}>
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
            </Fold>
          )}

          {referrals.length > 0 && (
            <Fold card title="Someone they named" open fact={String(referrals.length)}>
              <div className="stack">
                {referrals.map((r) => (
                  <div className="between" key={r.id} style={{ padding: "11px 0", borderBottom: "1px solid var(--rule-soft)" }}>
                    <span className="stack" style={{ gap: 3 }}>
                      <span style={{ fontSize: 14.5 }}>{r.name}</span>
                      <span className="mono-sm">{r.contact}</span>
                    </span>
                    <Confirm
                      trigger="Forget them"
                      triggerClass="link-mono"
                      title={`Forget ${r.name}?`}
                      line="Their name and contact are deleted for good. This is the one record that can be, because it is someone else's."
                      confirmLabel="Forget them"
                      action={forgetReferralAction}
                    >
                      <input type="hidden" name="referralId" value={r.id} />
                    </Confirm>
                  </div>
                ))}
              </div>
              <p className="help" style={{ lineHeight: 1.65 }}>
                Shown here and nowhere else: not on any client page, not in an export, not in a WhatsApp message.
              </p>
            </Fold>
          )}

          <Fold
            card
            title="The questionnaire"
            ember={Boolean(intake && !intake.submittedAt && !ended)}
            open={Boolean(intake && !intake.submittedAt && !ended)}
            fact={!intake ? "not uploaded yet" : intake.submittedAt ? `submitted ${dayMonth(intake.submittedAt)}` : progress ? `open, ${progress.done} of ${progress.total} sections` : "open"}
          >
            {!intake && (
              <>
                <p className="c-sub" style={{ fontSize: 14 }}>Not uploaded yet. The client sees &ldquo;nothing to do yet&rdquo; until it is.</p>
                {!ended && <div><Link className="a-btn" href={`/admin/clients/${project.client.id}/intake/upload`}>Upload questionnaire</Link></div>}
              </>
            )}
            {intake && doc && (
              <>
                <div className="stack">
                  <div className="between" style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}><span>Uploaded {dayMonth(intake.documentUploadedAt)} by {intake.documentUploadedBy.name}</span><span className="mono-sm">{doc.title}</span></div>
                  <div className="between" style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}><span>{doc.sections.length} sections, {doc.sections.reduce((n, s) => n + s.questions.length, 0)} questions, {doc.sections.find((s) => s.access_items)?.access_items?.length ?? 0} access items</span><span className="mono-sm">{intake.submittedAt ? `submitted ${dayMonthTime(intake.submittedAt)}` : progress && intake.lastSavedAt ? `saved ${dayMonthTime(intake.lastSavedAt)}` : "not started"}</span></div>
                  <div className="between" style={{ padding: "9px 0" }}><span>Answers so far</span><span className="mono-sm">{byClient} by the client, {byTeam} by the team</span></div>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link className="a-btn" href={`/admin/clients/${project.client.id}/intake`}>What they told us</Link>
                  {!ended && <Link className="a-btn ghost" href={`/admin/clients/${project.client.id}/intake/upload`}>Replace the document</Link>}
                  <a className="a-btn ghost" href={`/admin/clients/${project.client.id}/intake/answers.json`}>Download answers JSON</a>
                </div>
              </>
            )}
          </Fold>

          <Fold card title="The client" fact={c.businessName}>
            <div className="stack">
              <div className="between" style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}><span>{c.businessName}</span><span className="mono-sm">{c.location ?? ""}</span></div>
              <div className="between" style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}><span>{c.contactName}</span><span className="mono-sm">{c.contactPhone}</span></div>
              <div className="between" style={{ padding: "9px 0" }}><span>{c.contactEmail}</span><span className="help">who we talk to day to day</span></div>
            </div>
            <div><Link className="a-btn ghost" href={`/admin/clients/${c.id}`}>Open the client</Link></div>
          </Fold>

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

          <Fold card title="Who signs off" ember={Boolean(project.client.proposedSignoffEmail && !ended)} open={Boolean(project.client.proposedSignoffEmail && !ended)} fact={project.signoffPersonName}>
            {ended ? (
              <p className="c-sub" style={{ fontSize: 14 }}>{project.signoffPersonName}, {project.signoffPersonEmail}</p>
            ) : (
              <form action={updateSignoffAction} className="stack" style={{ gap: 10 }}>
                <input type="hidden" name="projectId" value={project.id} />
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Name</span><input className="a-fld" name="signoffPersonName" defaultValue={project.signoffPersonName} required /></label>
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Their email, where the code goes</span><input className="a-fld" name="signoffPersonEmail" type="email" defaultValue={project.signoffPersonEmail} required /></label>
                <div><button className="a-btn ghost" type="submit">Save</button></div>
              </form>
            )}
            <p className="help">Per project, not per client: a business can have a different approver for a brand job than for a store rebuild.</p>
            {!ended && project.client.proposedSignoffEmail && (
              <form action={signoffDecisionAction} className="stack" style={{ gap: 8, borderTop: "1px solid var(--rule-soft)", paddingTop: 12 }}>
                <input type="hidden" name="projectId" value={project.id} />
                <input type="hidden" name="clientId" value={project.client.id} />
                <span className="k ember">The client typed a different sign-off on the questionnaire</span>
                <p className="mono-sm" style={{ margin: 0, color: "var(--ink)" }}>{project.client.proposedSignoffName ? `${project.client.proposedSignoffName}, ` : ""}{project.client.proposedSignoffEmail}</p>
                <p className="help">Codes keep going to the address above until you switch it.</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="a-btn" name="decision" value="use" type="submit">Use the new one</button>
                  <button className="a-btn ghost" name="decision" value="keep" type="submit">Keep the old one</button>
                </div>
              </form>
            )}
          </Fold>
          {referrals.length === 0 && testimonials.length === 0 && signoffs.length === 0 && rounds.length === 0 && updates.length === 0 && invoices.length === 0 && !ended && (
            <Empty title="Nothing on the record yet" line="Invoices, sign-offs, rounds and updates appear here as they happen." />
          )}
        </div>
      </div>
    </AdminShell>
  );
}
