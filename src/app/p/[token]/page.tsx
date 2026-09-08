import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientShell } from "@/components/portal/ClientShell";
import { Phase } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { dayMonthYear } from "@/lib/dates";
import { currentClientSession, projectByToken } from "@/modules/auth/client";
import { intakeProgress } from "@/modules/intake/progress";
import { invoiceToClientView } from "@/modules/serializers";
import { CodeScreen } from "./CodeScreen";

/**
 * PORTAL-SPEC 6.1 and the one-thing-to-do rule: what this page shows depends
 * on the phase, and only the current phase is loud. Everything else is below
 * it or collapsed.
 */
export default async function ProjectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const project = await projectByToken(token);
  if (!project) notFound();

  const session = await currentClientSession(project.id);
  if (!session) {
    return (
      <ClientShell businessName={project.client.businessName}>
        <CodeScreen token={token} personName={project.client.signoffPersonName} />
      </ClientShell>
    );
  }

  const [agreement, invoices] = await Promise.all([
    db.agreement.findUnique({ where: { projectId: project.id } }),
    db.invoice.findMany({ where: { projectId: project.id }, orderBy: { issuedAt: "asc" } }),
  ]);
  const intake = project.intake;
  const progress = intake ? intakeProgress(intake.document, intake.answers, intake.sectionsDone) : null;
  const phase = project.phase;

  return (
    <ClientShell businessName={project.client.businessName}>
      <div style={{ padding: "22px 20px 18px" }} className="stack">
        <p className="k">Your project</p>
        <h1 className="c-title" style={{ fontSize: 26, marginTop: 9 }}>{project.name}</h1>
      </div>

      <div style={{ padding: "0 20px" }} className="stack">
        {phase === Phase.CANCELLED && (
          <Card>
            <span className="sec-name" style={{ fontSize: 17 }}>This project was closed on {dayMonthYear(project.cancelledAt)}.</span>
            <p className="c-sub">Everything below is still here to read. If that is a surprise, message Rahul and he will explain.</p>
          </Card>
        )}

        {phase === Phase.INTAKE && !intake && (
          <Card>
            <span className="sec-name" style={{ fontSize: 17 }}>Nothing for you to do yet</span>
            <p className="c-sub">
              Rahul is writing your questionnaire from what you said on the call, so it asks about your business and not everyone else&rsquo;s. It turns up here when it is ready and we will message you.
            </p>
            <p className="c-sub">Nothing is needed from you until then.</p>
          </Card>
        )}

        {phase === Phase.INTAKE && intake && progress && (
          <Card loud>
            <p className="k ember">Now</p>
            <span className="sec-name" style={{ fontSize: 19, lineHeight: 1.2 }}>Before we start, about ten minutes</span>
            <p className="c-sub">
              {progress.done > 0
                ? `You are ${progress.done} of ${progress.total} sections in. Pick up where you left off.`
                : `${progress.total} short sections, mostly about what is going wrong in your own words.`}
            </p>
            <p className="c-sub">It saves as you type, so you can stop anywhere and come back.</p>
            <Link className="btn-full" href={`/p/${token}/intake`} style={{ marginTop: 4 }}>
              {progress.done > 0 ? "Carry on with the questionnaire" : "Open the questionnaire"}
            </Link>
          </Card>
        )}

        {phase === Phase.AGREEMENT_DRAFT && (
          <Card>
            <span className="sec-name" style={{ fontSize: 17 }}>
              {intake?.submittedAt ? `Got it, thank you. Sent ${dayMonthYear(intake.submittedAt)}.` : "Got it, thank you."}
            </span>
            <p className="c-sub">
              We are turning your answers into one page: what we are building, what it costs, when it lands, and how you will know it is done. It turns up here when it is ready and we will message you.
            </p>
          </Card>
        )}

        {phase === Phase.AGREEMENT_SENT && (
          <Card loud>
            <p className="k ember">Now</p>
            <span className="sec-name" style={{ fontSize: 19, lineHeight: 1.2 }}>Your agreement is ready to read</span>
            <p className="c-sub">One page, and worth reading properly. If anything in it is wrong, say so on the same page and we will change it. Nothing is invoiced until you agree.</p>
            <Link className="btn-full" href={`/p/${token}/agreement`} style={{ marginTop: 4 }}>Read the agreement</Link>
          </Card>
        )}

        {(phase === Phase.AGREED || phase === Phase.BUILDING) && (
          <Card>
            <span className="sec-name" style={{ fontSize: 17 }}>
              {phase === Phase.AGREED ? "Agreed, thank you. We start shortly." : "We are building it."}
            </span>
            <p className="c-sub">
              {phase === Phase.AGREED
                ? "Rahul will confirm the kickoff date with you, and the weekly updates start from there."
                : "A written update lands here every week, whether or not anything went wrong."}
            </p>
          </Card>
        )}

        {/* Below the fold, collapsed: the record so far. */}
        {intake?.submittedAt && phase !== Phase.INTAKE && (
          <Collapsed summary="What you told us">
            <Link className="btn-full ghost" href={`/p/${token}/intake`}>Read it back, and change anything</Link>
          </Collapsed>
        )}

        {agreement?.sentAt && phase !== Phase.AGREEMENT_SENT && (
          <Collapsed summary={agreement.agreedAt ? `Your agreement, agreed ${dayMonthYear(agreement.agreedAt)}` : "Your agreement"}>
            <Link className="btn-full ghost" href={`/p/${token}/agreement`}>Read it again</Link>
          </Collapsed>
        )}

        {invoices.length > 0 && (
          <Collapsed summary={invoices.length === 1 ? "Your invoice" : "Your invoices"}>
            <div className="stack" style={{ gap: 8 }}>
              {invoices.map((raw) => {
                const i = invoiceToClientView(raw);
                return (
                  <div key={i.id} className="between" style={{ padding: "12px 14px", border: "1px solid var(--rule)", borderRadius: 2 }}>
                    <span className="stack" style={{ gap: 2 }}>
                      <span className="mono-sm" style={{ color: "var(--ink)", fontSize: 12 }}>{i.number}</span>
                      <span className="help">{i.kindLabel} · {i.issuedAt}</span>
                    </span>
                    <span className="stack" style={{ gap: 2, alignItems: "flex-end" }}>
                      <span className="mono-sm" style={{ color: "var(--ink)", fontSize: 13 }}>{i.total}</span>
                      <span className="tag">{i.statusLabel}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </Collapsed>
        )}
      </div>
    </ClientShell>
  );
}

function Card({ children, loud }: { children: React.ReactNode; loud?: boolean }) {
  return (
    <div className={`card${loud ? " now" : ""}`} style={{ padding: "18px 16px" }}>
      <div className="stack" style={{ gap: 12 }}>{children}</div>
    </div>
  );
}

function Collapsed({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="pushback" style={{ borderTop: "1px solid var(--rule-soft)", marginTop: 4 }}>
      <summary>{summary}</summary>
      <div style={{ paddingTop: 12 }}>{children}</div>
    </details>
  );
}
