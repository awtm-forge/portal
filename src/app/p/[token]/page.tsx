import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientShell } from "@/components/portal/ClientShell";
import { Phase } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { dayMonthYear } from "@/lib/dates";
import { currentClientSession, projectByToken } from "@/modules/auth/client";
import { intakeProgress } from "@/modules/intake/progress";
import { invoiceToClientView, updateToClientView } from "@/modules/serializers";
import { sentForProject } from "@/modules/updates";
import { company } from "@/modules/settings";
import { WeeklyUpdate } from "@/components/portal/WeeklyUpdate";
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
        <CodeScreen token={token} personName={project.signoffPersonName} />
      </ClientShell>
    );
  }

  const [agreement, invoices, updateRows, c] = await Promise.all([
    db.agreement.findUnique({ where: { projectId: project.id } }),
    db.invoice.findMany({ where: { projectId: project.id }, orderBy: { issuedAt: "asc" } }),
    sentForProject(project.id),
    company(),
  ]);
  const updates = updateRows.map(updateToClientView);
  const latest = updates[0] ?? null;
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

        {phase === Phase.AGREED && (
          <Card>
            <span className="sec-name" style={{ fontSize: 17 }}>Agreed, thank you. We start shortly.</span>
            <p className="c-sub">Rahul will confirm the kickoff date with you, and the weekly updates start from there.</p>
          </Card>
        )}

        {phase === Phase.BUILDING && (
          <Card loud={Boolean(latest)}>
            {latest ? (
              <>
                <p className="k ember">
                  {project.weekCount ? `Week ${latest.weekNumber} of ${project.weekCount}` : `Week ${latest.weekNumber}`}
                </p>
                <span className="sec-name" style={{ fontSize: 19, lineHeight: 1.2 }}>Where your project is</span>
                <p className="help">Sent {latest.sentAt}</p>
                <WeeklyUpdate update={latest} full />
              </>
            ) : (
              <>
                <span className="sec-name" style={{ fontSize: 17 }}>We are building it.</span>
                <p className="c-sub">A written update lands here every week, whether or not anything went wrong. The first one is on its way.</p>
              </>
            )}
            {c.bookingUrl && (
              <a className="btn-full ghost" href={c.bookingUrl} target="_blank" rel="noopener" style={{ marginTop: 4 }}>
                Book a sync
              </a>
            )}
          </Card>
        )}

        {phase === Phase.IN_REVIEW && (
          <Card loud>
            <p className="k ember">Now</p>
            <span className="sec-name" style={{ fontSize: 19, lineHeight: 1.2 }}>Ready for you to check</span>
            <p className="c-sub">
              The work is finished. Have a look at it against what you agreed to, and either tell us what is off or sign it off. Nothing is invoiced until you are happy.
            </p>
            <Link className="btn-full" href={`/p/${token}/review`} style={{ marginTop: 4 }}>Check the work</Link>
          </Card>
        )}

        {(phase === Phase.DELIVERED || phase === Phase.CLOSED) && (
          <Card>
            <span className="sec-name" style={{ fontSize: 19, lineHeight: 1.2 }}>
              Delivered on {dayMonthYear(project.deliveredAt)}
            </span>
            {project.afterDelivery === "RETAINER" ? (
              <div className="stack" style={{ gap: 6 }}>
                <p className="c-sub">
                  {project.retainerNamedPerson
                    ? `${project.retainerNamedPerson} is your person from here.`
                    : "We run it monthly from here."}
                  {project.retainerResponseTime ? ` You will hear back within ${project.retainerResponseTime}.` : ""}
                </p>
                {project.retainerTier && <p className="help">{project.retainerTier}</p>}
              </div>
            ) : project.afterDelivery === "HANDOVER" ? (
              <div className="stack" style={{ gap: 8 }}>
                <p className="c-sub">Everything is documented and every access is yours.</p>
                {project.handoverDocUrl && (
                  <a className="btn-full ghost" href={project.handoverDocUrl} target="_blank" rel="noopener">Open the handover document</a>
                )}
              </div>
            ) : (
              <p className="c-sub">{agreement?.afterDeliveryOffer || "Rahul will confirm what happens from here."}</p>
            )}
            {!project.thanksSeenAt && (
              <Link className="btn-full ghost" href={`/p/${token}/thanks`}>Say how it went, if you would like to</Link>
            )}
          </Card>
        )}

        {/* Below the fold, collapsed: the record so far. */}
        {updates.length > 1 && (
          <Collapsed summary={`Earlier weeks, ${updates.length - 1}`}>
            <div className="stack">
              {updates.slice(1).map((u) => (
                <details key={u.id} className="pushback" style={{ borderTop: "none", paddingTop: 0, marginTop: 0 }}>
                  <summary>Week {u.weekNumber}, {u.sentAt}</summary>
                  <div style={{ paddingTop: 10 }}><WeeklyUpdate update={u} full /></div>
                </details>
              ))}
            </div>
          </Collapsed>
        )}

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
                      {i.kind === "OTHER" && <span className="help" style={{ color: "var(--ink)" }}>{i.description}</span>}
                    </span>
                    <span className="stack" style={{ gap: 2, alignItems: "flex-end" }}>
                      <span className="mono-sm" style={{ color: "var(--ink)", fontSize: 13 }}>{i.total}</span>
                      <a className="tag" href={`/invoice/${i.id}/print`} target="_blank" rel="noopener" style={{ color: "var(--ember)" }}>
                        {i.statusLabel}, open it
                      </a>
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
