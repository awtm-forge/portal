import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientShell } from "@/components/portal/ClientShell";
import { InvoiceList } from "@/components/portal/InvoiceList";
import { Journey, journeyFor, pendingTask, standingStatus, type PendingTask } from "@/components/portal/Journey";
import { Phase } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { dayMonthYear } from "@/lib/dates";
import { clientByToken, currentClientSession, maskEmail } from "@/modules/auth/client";
import { activeProjectFor } from "@/modules/clients";
import { intakeProgress } from "@/modules/intake/progress";
import { forProject as day30For, isUnlocked as day30Unlocked } from "@/modules/day30";
import { invoiceToClientView, updateToClientView } from "@/modules/serializers";
import { sentForProject } from "@/modules/updates";
import { WeeklyUpdate } from "@/components/portal/WeeklyUpdate";
import { CodeScreen } from "./CodeScreen";

/**
 * The client home (items 1 to 5). It leads with the one thing we are waiting
 * on the client for, as a plain task with an instruction and one action, or a
 * calm "here is where things stand" when the ball is in our court. The journey
 * row says where they are; the record is folded below; a person is one tap
 * away in the header. Never a screen without a next step or an explanation.
 */
export default async function ProjectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await clientByToken(token);
  if (!client) notFound();

  const session = await currentClientSession(client.id);
  if (!session) {
    return (
      <ClientShell businessName={client.businessName}>
        <CodeScreen token={token} personName={client.contactName} maskedEmail={maskEmail(client.contactEmail)} />
      </ClientShell>
    );
  }

  const intake = client.intake;
  const progress = intake ? intakeProgress(intake.document, intake.answers, intake.sectionsDone) : null;
  const project = await activeProjectFor(client.id);
  const phase = project?.phase ?? null;

  const [agreement, invoices, updateRows, day30] = project
    ? await Promise.all([
        db.agreement.findUnique({ where: { projectId: project.id } }),
        db.invoice.findMany({ where: { projectId: project.id }, orderBy: { issuedAt: "asc" } }),
        sentForProject(project.id),
        day30For(project.id),
      ])
    : [null, [], [], null];

  const day30Due = day30 !== null && day30Unlocked(day30) && day30.metricAfterSubmittedAt === null;
  const updates = updateRows.map(updateToClientView);
  const latest = updates[0] ?? null;

  const facts = { hasIntake: Boolean(intake), intakeSubmitted: Boolean(intake?.submittedAt) };
  const journey = journeyFor(phase, { intakeSubmitted: facts.intakeSubmitted, day30Done: day30 !== null && day30.metricAfterSubmittedAt !== null });
  const task = pendingTask(phase, {
    ...facts,
    sectionsDone: progress?.done ?? 0,
    sectionsTotal: progress?.total ?? 0,
    day30Due,
  });
  const standing = standingStatus(phase, facts);

  return (
    <ClientShell businessName={client.businessName} nav={{ token, clientId: client.id, current: "home" }}>
      <div style={{ padding: "22px 20px 16px" }} className="stack">
        <p className="k">{project ? "Your project" : "Your page"}</p>
        <h1 className="c-title" style={{ fontSize: 26, marginTop: 8 }}>{project ? project.name : client.businessName}</h1>
        {journey && <Journey state={journey} />}
      </div>

      <div style={{ padding: "0 20px", gap: 12 }} className="stack">
        {task ? <ToDo token={token} task={task} /> : <Standing title={standing.title} detail={standing.detail} />}

        {phase === Phase.BUILDING && latest && (
          <div className="card">
            <div className="card-h open" style={{ display: "block" }}>
              <p className="k ember">{project?.weekCount ? `Week ${latest.weekNumber} of ${project.weekCount}` : `Week ${latest.weekNumber}`}</p>
              <p className="help" style={{ marginTop: 6 }}>Sent {latest.sentAt}</p>
            </div>
            <div className="card-b"><WeeklyUpdate update={latest} full /></div>
          </div>
        )}

        {(phase === Phase.DELIVERED || phase === Phase.CLOSED) && (
          <div className="card stand">
            <p className="k">Delivered {dayMonthYear(project?.deliveredAt)}</p>
            {project?.afterDelivery === "RETAINER" ? (
              <>
                <p>{project.retainerNamedPerson ? `${project.retainerNamedPerson} is your person from here.` : "We run it monthly from here."}{project.retainerResponseTime ? ` You will hear back within ${project.retainerResponseTime.toLowerCase()}.` : ""}</p>
                {project.retainerTier && <p className="help">{project.retainerTier}</p>}
              </>
            ) : project?.afterDelivery === "HANDOVER" ? (
              <>
                <p>Everything is documented and every access is yours.</p>
                {project.handoverDocUrl && <a className="btn-full ghost" href={project.handoverDocUrl} target="_blank" rel="noopener" style={{ marginTop: 6 }}>Open the handover document</a>}
              </>
            ) : (
              <p>{agreement?.afterDeliveryOffer || "Rahul will confirm what happens from here."}</p>
            )}
            {project && !project.thanksSeenAt && !day30Due && (
              <Link className="btn-full ghost" href={`/p/${token}/thanks`} style={{ marginTop: 6 }}>Say how it went, if you would like to</Link>
            )}
          </div>
        )}

        {/* The record, folded below. */}
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
            <Link className="btn-full ghost" href={`/p/${token}/intake`}>Read it back</Link>
          </Collapsed>
        )}

        {agreement?.sentAt && phase !== Phase.AGREEMENT_SENT && (
          <Collapsed summary={agreement.agreedAt ? `Your agreement, agreed ${dayMonthYear(agreement.agreedAt)}` : "Your agreement"}>
            <Link className="btn-full ghost" href={`/p/${token}/agreement`}>Read it again</Link>
          </Collapsed>
        )}

        {invoices.length > 0 && (
          <Collapsed summary={invoices.length === 1 ? "Your invoice" : "Your invoices"}>
            <InvoiceList invoices={invoices.map(invoiceToClientView)} />
          </Collapsed>
        )}

        <Collapsed summary="How this works">
          <ol className="how">
            <li><b>Agree the shape.</b> You read one page, what we will build and how you will check it, and agree to it once. Nothing is invoiced until you do.</li>
            <li><b>Something you can open.</b> By about day ten there is a real link, not a screenshot. It will be rough, and that is the point.</li>
            <li><b>The build.</b> A short written update here every week, and a call every two weeks that either of us can book.</li>
            <li><b>Delivery.</b> You check the work against what you agreed to. If something is off, you say so and we keep going. When it holds, you sign off and we invoice the balance.</li>
          </ol>
        </Collapsed>
      </div>
    </ClientShell>
  );
}

function ToDo({ token, task }: { token: string; task: PendingTask }) {
  return (
    <div className="card now todo">
      <div className="todo-head">
        <p className="k ember">What we need from you</p>
        {task.meta && <span className="help">{task.meta}</span>}
      </div>
      <h2>{task.title}</h2>
      <p className="todo-detail">{task.detail}</p>
      <Link className="btn-full" href={`/p/${token}${task.path}`}>{task.cta}</Link>
    </div>
  );
}

function Standing({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="card stand">
      <p className="k">Where things stand</p>
      <h2>{title}</h2>
      <p>{detail}</p>
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
