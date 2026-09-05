import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/admin-auth";
import { projectLink } from "@/lib/client-auth";
import { db } from "@/lib/db";
import { dayMonth, dayMonthTime } from "@/lib/format";
import { intakeProgress } from "@/lib/intake/progress";
import { parseDocumentLoose } from "@/lib/intake/document";
import { questionnaireReadyMessage, waLink } from "@/lib/whatsapp";
import { rotateLinkAction, signoffDecisionAction, takeFlashLink, updateContactAction } from "../../actions";
import { CopyLink } from "./CopyLink";

const TYPE_LABEL: Record<string, string> = { STORE: "Store", APP: "App", SAAS: "SaaS", MARKETING: "Marketing", BRAND: "Brand" };

export default async function ProjectAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: { client: true, intake: { include: { documentUploadedBy: { select: { name: true } } } } },
  });
  if (!project) notFound();
  const c = project.client;
  const freshToken = await takeFlashLink(project.id);
  const link = freshToken ? projectLink(freshToken) : null;
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
        <p className="a-sub">{c.businessName} · {TYPE_LABEL[project.typeOfWork]} · created {dayMonth(project.createdAt)}</p>
      </div>
      <div className="a-cols">
        <div className="main">
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
            <span className="k">Contact</span>
            <form action={updateContactAction} className="stack" style={{ gap: 14 }}>
              <input type="hidden" name="projectId" value={project.id} />
              <div className="grid2">
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Contact name</span><input className="a-fld" name="contactName" defaultValue={c.contactName} required /></label>
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Phone, with country code</span><input className="a-fld" name="contactPhone" defaultValue={c.contactPhone} required /></label>
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Contact email</span><input className="a-fld" name="contactEmail" type="email" defaultValue={c.contactEmail} required /></label>
                <span />
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Sign-off person</span><input className="a-fld" name="signoffPersonName" defaultValue={c.signoffPersonName} required /></label>
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Sign-off email, where the code goes</span><input className="a-fld" name="signoffPersonEmail" type="email" defaultValue={c.signoffPersonEmail} required /></label>
              </div>
              <div><button className="a-btn ghost" type="submit">Save contact</button></div>
            </form>
          </div>
        </div>

        <div className="aside">
          <div className={`a-card${link ? " ember" : ""}`}>
            <span className={`k${link ? " ember" : ""}`}>The client link</span>
            {link ? (
              <>
                <div className="a-fld mono" style={{ wordBreak: "break-all", color: "var(--ink)" }}>{link}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <CopyLink link={link} />
                  <a className="a-btn ghost" href={waLink(c.contactPhone, questionnaireReadyMessage({ contactName: c.contactName, link }))} target="_blank" rel="noopener">Send on WhatsApp</a>
                </div>
                <p className="help" style={{ lineHeight: 1.6 }}>Shown this once. Only a hash of it is stored, so copy it now. Leaving this page hides it. Rotating makes a new one.</p>
              </>
            ) : (
              <>
                <div className="a-fld mono" style={{ color: "var(--muted)" }}>awtmforge.com/p/…</div>
                <p className="help" style={{ lineHeight: 1.6 }}>Only a hash of the link is stored. It was shown once when created{project.tokenRotatedAt ? ` and again when rotated on ${dayMonth(project.tokenRotatedAt)}` : ""}. To send it again, rotate it.</p>
              </>
            )}
            <form action={rotateLinkAction} style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 12 }}>
              <input type="hidden" name="projectId" value={project.id} />
              <p className="help" style={{ lineHeight: 1.6, marginBottom: 8 }}>Created {dayMonth(project.tokenCreatedAt)}. {project.tokenRotatedAt ? `Rotated ${dayMonth(project.tokenRotatedAt)}.` : "Never rotated."}<br />Rotating kills the old link and every signed-in phone immediately.</p>
              <button className="link-mono" type="submit" style={{ padding: 0, color: "var(--faint)", fontSize: "10.5px" }}>Rotate the link</button>
            </form>
          </div>

          <div className={`a-card${c.proposedSignoffEmail ? " ember" : ""}`}>
            <span className="k">Who signs off</span>
            <p style={{ margin: 0 }}>{c.signoffPersonName}</p>
            <p className="mono-sm" style={{ margin: 0 }}>{c.signoffPersonEmail}</p>
            <p className="help">The six digit code goes here.</p>
            {c.proposedSignoffEmail && (
              <form action={signoffDecisionAction} className="stack" style={{ gap: 8, borderTop: "1px solid var(--rule-soft)", paddingTop: 12 }}>
                <input type="hidden" name="projectId" value={project.id} />
                <span className="k ember">The client typed a different sign-off</span>
                <p className="mono-sm" style={{ margin: 0, color: "var(--ink)" }}>{c.proposedSignoffName ? `${c.proposedSignoffName}, ` : ""}{c.proposedSignoffEmail}</p>
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
