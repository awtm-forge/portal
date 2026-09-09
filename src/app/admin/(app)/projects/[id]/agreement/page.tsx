import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Phase } from "@/generated/prisma/enums";
import { dayMonthTime } from "@/lib/dates";
import { requireAdmin } from "@/modules/auth/admin";
import { forAgreementEditor, notesForAdmin } from "@/modules/projects";
import { agreementToAdminView } from "@/modules/serializers";
import { readAnswers } from "@/modules/intake/answers";
import { company } from "@/modules/settings";
import { AgreementEditor } from "./AgreementEditor";
import { overrideIntakeAction } from "./actions";

export default async function AgreementEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const project = await forAgreementEditor(id);
  if (!project) notFound();

  const notes = await notesForAdmin(id);
  const c = await company();
  const view = project.agreement ? agreementToAdminView(project.agreement) : null;
  const answers = project.client.intake ? readAnswers(project.client.intake.answers) : {};
  const suggestedMetric = typeof answers.mk_metric_now?.value === "string" ? answers.mk_metric_now.value : "";
  const intakeSubmitted = Boolean(project.client.intake?.submittedAt) || Boolean(project.client.intake?.overriddenAt);

  return (
    <AdminShell active="projects" adminName={admin.name}>
      <div className="between" style={{ alignItems: "flex-end" }}>
        <div className="stack" style={{ gap: 6 }}>
          <h1 className="a-title">The agreement</h1>
          <p className="a-sub">
            {project.name} · {project.client.businessName}
            {view?.isAgreed ? ` · agreed by ${view.agreedByName} on ${view.agreedAt}` : view?.sentAt ? ` · sent, version ${view.version}` : " · draft"}
          </p>
        </div>
        <Link className="a-btn ghost" href={`/admin/projects/${id}`}>Back to the project</Link>
      </div>

      {!intakeSubmitted && project.phase === Phase.INTAKE && (
        <div className="a-card ember">
          <span className="k ember">The questionnaire is not submitted</span>
          <p className="c-sub" style={{ fontSize: 14 }}>
            PORTAL-SPEC 5.3: the agreement cannot be sent until the client submits the questionnaire. Override it if you took the answers on a call. The override records who and when.
          </p>
          <form action={overrideIntakeAction}>
            <input type="hidden" name="projectId" value={id} />
            <button className="a-btn ghost" type="submit">Override, I took the answers on a call</button>
          </form>
        </div>
      )}

      {project.client.intake?.overriddenAt && (
        <p className="help">Questionnaire gate overridden by {project.client.intake.overriddenById} on {dayMonthTime(project.client.intake.overriddenAt)}.</p>
      )}

      {notes.length > 0 && (
        <div className="a-card ember">
          <span className="k ember">What the client said was off</span>
          <div className="stack">
            {notes.map((n) => (
              <div className="row" key={n.id}>
                <span className="lbl">Version {n.agreementVersion} · {dayMonthTime(n.createdAt)}</span>
                <p style={{ margin: 0, fontSize: 14.5, whiteSpace: "pre-wrap" }}>{n.text}</p>
              </div>
            ))}
          </div>
          <p className="help">Answer by editing the agreement and sending it again, or on WhatsApp. There is no reply box here on purpose.</p>
        </div>
      )}

      <AgreementEditor
        projectId={id}
        view={view}
        frozen={Boolean(view?.isAgreed)}
        canSend={intakeSubmitted && project.phase === Phase.AGREEMENT_DRAFT}
        defaultAdvancePct={c.defaultAdvancePct}
        bookingUrl={c.bookingUrl}
        project={{
          weekCount: project.weekCount,
          metricName: project.metricName,
          metricBaselineValue: project.metricBaselineValue,
          afterDelivery: project.afterDelivery,
          retainerTier: project.retainerTier,
          retainerNamedPerson: project.retainerNamedPerson,
          retainerResponseTime: project.retainerResponseTime,
          handoverDocUrl: project.handoverDocUrl,
        }}
        suggestedMetric={suggestedMetric}
        totalPaise={view?.totalPaiseRaw ?? "0"}
        internalCostPaise={view?.internalCostPaise ?? "0"}
        startDateIso={project.agreement?.startDate ? project.agreement.startDate.toISOString().slice(0, 10) : ""}
        launchDateIso={project.agreement?.launchTargetDate ? project.agreement.launchTargetDate.toISOString().slice(0, 10) : ""}
      />
    </AdminShell>
  );
}
