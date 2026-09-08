import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/modules/auth/admin";
import { db } from "@/lib/db";
import { dayMonth, dayMonthTime } from "@/lib/format";
import { intakeProgress } from "@/modules/intake/progress";
import { parseDocumentLoose } from "@/modules/intake/document";
import { PHASE_LABEL } from "@/modules/projects/phase";
import { agreementToAdminView, invoiceToClientView } from "@/modules/serializers";
import { signoffDecisionAction, updateSignoffAction } from "../../actions";

const TYPE_LABEL: Record<string, string> = { STORE: "Store", APP: "App", SAAS: "SaaS", MARKETING: "Marketing", BRAND: "Brand" };

export default async function ProjectAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: { client: true, intake: { include: { documentUploadedBy: { select: { name: true } } } }, agreement: true },
  });
  if (!project) notFound();
  const [invoices, signoffs, noteCount] = await Promise.all([
    db.invoice.findMany({ where: { projectId: id }, orderBy: { issuedAt: "asc" } }),
    db.signoffEvent.findMany({ where: { projectId: id }, orderBy: { occurredAt: "asc" } }),
    db.agreementNote.count({ where: { projectId: id } }),
  ]);
  const agreement = project.agreement ? agreementToAdminView(project.agreement) : null;
  const c = project.client;
  const intake = project.intake;
  const doc = intake ? parseDocumentLoose(intake.document) : null;
  const progress = intake ? intakeProgress(intake.document, intake.answers, intake.sectionsDone) : null;
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
              <Link className="a-btn" href={`/admin/projects/${project.id}/agreement`}>{agreement ? (agreement.isAgreed ? "Read the agreement" : "Edit and send") : "Write the agreement"}</Link>
              {agreement?.sentAt && <a className="a-btn ghost" href={`/agreement/${project.id}/print`} target="_blank" rel="noopener">Print view</a>}
            </div>
          </div>

          {invoices.length > 0 && (
            <div className="a-card">
              <span className="k">Invoices</span>
              <div className="stack">
                {invoices.map((raw) => {
                  const i = invoiceToClientView(raw);
                  return (
                    <div className="between" key={i.id} style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}>
                      <span className="stack" style={{ gap: 2 }}>
                        <span className="mono-sm" style={{ color: "var(--ink)" }}>{i.number}</span>
                        <span className="help">{i.kindLabel} · {i.issuedAt}</span>
                      </span>
                      <span className="stack" style={{ gap: 2, alignItems: "flex-end" }}>
                        <span className="mono-sm" style={{ color: "var(--ink)" }}>{i.total}</span>
                        <span className="tag">{i.statusLabel}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="help">Raised by a sign-off and by nothing else. Marking one paid arrives in step 9.</p>
            </div>
          )}

          {signoffs.length > 0 && (
            <div className="a-card">
              <span className="k">Sign-offs</span>
              <div className="stack">
                {signoffs.map((s) => (
                  <div className="between" key={s.id} style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}>
                    <span>{s.kind === "AGREEMENT" ? "Agreement" : "Delivery"} by {s.actorName}</span>
                    <span className="mono-sm">{dayMonthTime(s.occurredAt)} · {s.method === "WHATSAPP" ? "WhatsApp" : "portal"}</span>
                  </div>
                ))}
              </div>
              <p className="help">Append only. There is no path in the system that edits or deletes one.</p>
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
                <div><Link className="a-btn" href={`/admin/projects/${project.id}/intake/upload`}>Upload questionnaire</Link></div>
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
                  <Link className="a-btn" href={`/admin/projects/${project.id}/intake`}>What they told us</Link>
                  <Link className="a-btn ghost" href={`/admin/projects/${project.id}/intake/upload`}>Replace the document</Link>
                  <a className="a-btn ghost" href={`/admin/projects/${project.id}/intake/answers.json`}>Download answers JSON</a>
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
            <div className="a-fld mono" style={{ color: "var(--muted)" }}>awtmforge.com/p/…</div>
            <p className="help" style={{ lineHeight: 1.6 }}>
              Only a hash is stored, so the link itself can only be shown just after it is made. Created {dayMonth(project.tokenCreatedAt)}
              {project.tokenRotatedAt ? `, rotated ${dayMonth(project.tokenRotatedAt)}` : ""}.
            </p>
            {project.linkEmailError ? (
              <p className="help" style={{ color: "var(--ember)" }}>The link email to {project.signoffPersonEmail} did not go out.</p>
            ) : (
              <p className="help">
                {project.linkEmailedAt ? `Emailed to ${project.signoffPersonEmail} on ${dayMonth(project.linkEmailedAt)}.` : "Not emailed yet."}
              </p>
            )}
            <div><Link className="a-btn ghost" href={`/admin/projects/${project.id}/link`}>Send them the link</Link></div>
          </div>

          <div className={`a-card${project.proposedSignoffEmail ? " ember" : ""}`}>
            <span className="k">Who signs off, on this project</span>
            <form action={updateSignoffAction} className="stack" style={{ gap: 10 }}>
              <input type="hidden" name="projectId" value={project.id} />
              <label className="stack" style={{ gap: 6 }}><span className="lbl">Name</span><input className="a-fld" name="signoffPersonName" defaultValue={project.signoffPersonName} required /></label>
              <label className="stack" style={{ gap: 6 }}><span className="lbl">Their email, where the code goes</span><input className="a-fld" name="signoffPersonEmail" type="email" defaultValue={project.signoffPersonEmail} required /></label>
              <div><button className="a-btn ghost" type="submit">Save</button></div>
            </form>
            <p className="help">Per project, not per client: a business can have a different approver for a brand job than for a store rebuild.</p>
            {project.proposedSignoffEmail && (
              <form action={signoffDecisionAction} className="stack" style={{ gap: 8, borderTop: "1px solid var(--rule-soft)", paddingTop: 12 }}>
                <input type="hidden" name="projectId" value={project.id} />
                <span className="k ember">The client typed a different sign-off</span>
                <p className="mono-sm" style={{ margin: 0, color: "var(--ink)" }}>{project.proposedSignoffName ? `${project.proposedSignoffName}, ` : ""}{project.proposedSignoffEmail}</p>
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
