import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/modules/auth/admin";
import { db } from "@/lib/db";
import { dayMonth, dayMonthTime } from "@/lib/format";
import { readAnswers, readBoolMap, readStringList, type Answers } from "@/modules/intake/answers";
import { parseDocumentLoose, type Question } from "@/modules/intake/document";
import { intakeProgress } from "@/modules/intake/progress";
import { fileInfoMap } from "@/modules/intake/load";
import { questionnaireNudgeMessage, waLink } from "@/lib/whatsapp";

export default async function IntakeAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id }, include: { client: true, intake: true } });
  if (!project) notFound();
  const intake = project.intake;
  if (!intake) redirect(`/admin/projects/${id}`);
  const doc = parseDocumentLoose(intake.document);
  if (!doc) redirect(`/admin/projects/${id}`);
  const answers = readAnswers(intake.answers);
  const access = readBoolMap(intake.accessGranted);
  const hiddenKeys = readStringList(intake.hiddenQuestionKeys);
  const progress = intakeProgress(intake.document, intake.answers, intake.sectionsDone);
  const files = await fileInfoMap(project.id);
  const openSections = progress.sections.filter((s) => !s.done).map((s) => s.title);
  const answeredIn = (keys: string[]) => keys.filter((k) => answers[k] !== undefined).length;
  const c = project.client;
  const fileBase = `/admin/projects/${id}/file`;

  return (
    <AdminShell active="projects" adminName={admin.name}>
      <div className="between" style={{ alignItems: "flex-end" }}>
        <div className="stack" style={{ gap: 6 }}>
          <h1 className="a-title">What they told us</h1>
          <p className="a-sub">
            {c.businessName} · {intake.submittedAt ? `sent ${dayMonth(intake.submittedAt)}` : `open since ${dayMonth(intake.documentUploadedAt)}`} · {progress.done} of {progress.total} sections done
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!intake.submittedAt && <a className="a-btn" href={waLink(c.contactPhone, questionnaireNudgeMessage({ contactName: c.contactName.split(" ")[0] ?? c.contactName, openSections }))} target="_blank" rel="noopener">Nudge on WhatsApp</a>}
          <Link className="a-btn ghost" href={`/admin/projects/${id}/intake/fill`}>Type their answers</Link>
          <a className="a-btn ghost" href={`/admin/projects/${id}/intake/answers.json`}>Download JSON</a>
          <Link className="a-btn ghost" href={`/admin/projects/${id}`}>Project</Link>
        </div>
      </div>

      <div className="a-cols">
        <div className="main">
          {doc.sections.map((s, i) => {
            const keys = s.questions.map((q) => q.key);
            const n = answeredIn(keys);
            const highlight = i === 1;
            return (
              <div key={s.key} className={`a-card${highlight ? " ember" : ""}${n === 0 && !s.access_items ? " dashed" : ""}`}>
                <div className="between"><span className={`k${highlight ? " ember" : ""}`}>{s.title}</span><span className="mono-sm">{n} of {keys.length} answered{progress.sections[i]?.done ? ", done" : ""}</span></div>
                <div className="stack">
                  {s.questions.map((q) => (
                    <div className="row" key={q.key}>
                      <div className="between" style={{ alignItems: "baseline" }}>
                        <span className="lbl">{q.text}</span>
                        {answers[q.key]?.entered_by === "team" && <span className="tag ember">Taken on a call</span>}
                      </div>
                      <AnswerView q={q} answers={answers} files={files} fileBase={fileBase} highlight={highlight && q.key === "st_why"} />
                    </div>
                  ))}
                </div>
                {highlight && <p className="help" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 12, lineHeight: 1.65 }}>What made them call, what they tried, and the normal Tuesday go into the agreement almost unchanged. That is the point of asking before the kickoff call rather than during it.</p>}
              </div>
            );
          })}
          {hiddenKeys.length > 0 && (
            <div className="a-card dashed">
              <span className="k">Hidden since the last replacement</span>
              <p className="c-sub" style={{ fontSize: 13.5 }}>{hiddenKeys.length} {hiddenKeys.length === 1 ? "answer whose question is" : "answers whose questions are"} no longer in the document. Kept in the JSON.</p>
              <div className="stack">
                {hiddenKeys.map((k) => (
                  <div className="row" key={k}><span className="lbl mono">{k}</span><p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>{plainValue(answers[k])}</p></div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="aside">
          <div className="a-card">
            <span className="k">Progress</span>
            <div className="between"><span className="mono-sm" style={{ color: "var(--faint)" }}>Sections done</span><span className="mono-sm" style={{ color: "var(--ink)" }}>{progress.done} of {progress.total}</span></div>
            <div className="between"><span className="mono-sm" style={{ color: "var(--faint)" }}>Last saved</span><span className="mono-sm" style={{ color: "var(--ink)" }}>{intake.lastSavedAt ? dayMonthTime(intake.lastSavedAt) : "Not yet"}</span></div>
            <div className="between"><span className="mono-sm" style={{ color: "var(--faint)" }}>Submitted</span><span className="mono-sm" style={{ color: intake.submittedAt ? "var(--ink)" : "var(--faint)" }}>{intake.submittedAt ? dayMonthTime(intake.submittedAt) : "Not yet"}</span></div>
          </div>
          <div className="a-card">
            <span className="k">Access they have granted</span>
            <div className="stack">
              {(doc.sections.find((s) => s.access_items)?.access_items ?? []).map((it) => {
                const on = access[it.key] === true;
                return (
                  <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0" }}>
                    {on ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ember)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg> : <span className="mono-sm" style={{ width: 13, textAlign: "center", color: "var(--faint)" }}>·</span>}
                    <span style={{ fontSize: 13.5, color: on ? "var(--muted)" : "var(--ink)" }}>{it.label}</span>
                  </div>
                );
              })}
            </div>
            <p className="help" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 12, lineHeight: 1.65 }}>Ticks only. Nothing they granted is stored here, and no box on their side accepts a password.</p>
          </div>
          <div className="a-card">
            <span className="k">Who decides</span>
            <p style={{ margin: 0 }}>{project.signoffPersonName} signs off</p>
            <p className="mono-sm" style={{ margin: 0 }}>{project.signoffPersonEmail}</p>
            {project.proposedSignoffEmail && <p className="help" style={{ color: "var(--ember)" }}>The client typed {project.proposedSignoffEmail}. Confirm it on the project page.</p>}
            {typeof answers.dec_others?.value === "string" && answers.dec_others.value && <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)" }}>{answers.dec_others.value}</p>}
            {typeof answers.dec_calendar?.value === "string" && answers.dec_calendar.value && <p style={{ margin: 0, fontSize: 13.5, color: "var(--ember)", borderTop: "1px solid var(--rule-soft)", paddingTop: 12 }}>{answers.dec_calendar.value}</p>}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function plainValue(a: Answers[string] | undefined): string {
  if (!a) return "";
  if (a.files) return `${a.files.length} file(s)`;
  if (Array.isArray(a.value)) return a.value.join(", ");
  if (typeof a.value === "boolean") return a.value ? `Yes${a.note ? `. ${a.note}` : ""}` : "No";
  return typeof a.value === "string" ? a.value : "";
}

function AnswerView({ q, answers, files, fileBase, highlight }: { q: Question; answers: Answers; files: Record<string, { name: string; mime: string; hasThumb: boolean }>; fileBase: string; highlight: boolean }) {
  const a = answers[q.key];
  const none = <p style={{ margin: 0, fontSize: 14, color: "var(--faint)" }}>Not answered</p>;
  if (!a) return none;
  const style = { margin: 0, fontSize: 14.5, lineHeight: 1.5, color: highlight ? "var(--ember)" : "var(--ink)", whiteSpace: "pre-wrap" as const };
  switch (q.type) {
    case "short_text": case "long_text":
      return typeof a.value === "string" && a.value ? <p style={style}>{a.value}</p> : none;
    case "link":
      return typeof a.value === "string" && a.value ? <p style={style}><a href={a.value} target="_blank" rel="noopener noreferrer">{a.value}</a></p> : none;
    case "yes_no":
      return a.value === undefined ? none : <p style={style}>{a.value ? "Yes" : "No"}{a.value && !a.note && <span style={{ color: "var(--muted)" }}>. Not said more.</span>}{a.note ? `. ${a.note}` : ""}</p>;
    case "pick_one":
      return <p style={style}>{q.options.find((o) => o.id === a.value)?.label ?? <span style={{ color: "var(--faint)" }}>Option no longer in the questionnaire: {String(a.value)}</span>}</p>;
    case "pick_many": {
      const ids = Array.isArray(a.value) ? (a.value as string[]) : [];
      const known = q.options.filter((o) => ids.includes(o.id)).map((o) => o.label);
      const unknown = ids.filter((i) => !q.options.some((o) => o.id === i));
      return ids.length ? <p style={style}>{known.join(", ")}{unknown.length ? <span style={{ color: "var(--faint)" }}> Options no longer in the questionnaire: {unknown.join(", ")}</span> : null}</p> : none;
    }
    case "image_choice": {
      const ids = Array.isArray(a.value) ? (a.value as string[]) : [];
      const picked = q.options.filter((o) => ids.includes(o.id));
      return picked.length ? (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
          {picked.map((o) => (
            <div key={o.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="thumb" src={`/admin/lib/${encodeURIComponent(o.image)}`} alt="" style={{ borderColor: "var(--ember)" }} />
              <span style={{ fontSize: 14.5 }}>{o.label}</span>
            </div>
          ))}
        </div>
      ) : none;
    }
    case "upload": {
      const ids = a.files ?? [];
      return ids.length ? (
        <div className="stack" style={{ gap: 6 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            {ids.map((id) => {
              const f = files[id];
              return (
                <a key={id} href={`${fileBase}/${id}`} target="_blank" rel="noopener" title={f?.name} style={{ position: "relative", display: "block", width: 72, height: 72 }}>
                  {f?.hasThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="thumb" src={`${fileBase}/${id}?thumb`} alt="" />
                  ) : <span className="thumb" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono-stack)", fontSize: 9, color: "var(--muted)" }}>{f?.mime === "application/pdf" ? "PDF" : "file"}</span>}
                </a>
              );
            })}
          </div>
          <p className="help">{ids.length} {ids.length === 1 ? "file" : "files"}: {ids.map((id) => files[id]?.name ?? "file").join(", ")}. Served only to a signed-in team member or the holder of this link.</p>
        </div>
      ) : none;
    }
  }
}
