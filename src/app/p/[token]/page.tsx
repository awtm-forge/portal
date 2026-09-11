import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClientShell } from "@/components/portal/ClientShell";
import { InvoiceList } from "@/components/portal/InvoiceList";
import { Journey, journeyFor, pendingTask, standingStatus, type PendingTask } from "@/components/portal/Journey";
import { WeeklyUpdate } from "@/components/portal/WeeklyUpdate";
import { Fold } from "@/components/ui/Fold";
import { Phase } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { dayMonthYear } from "@/lib/dates";
import { currentClientSession, maskEmail, resolveClient } from "@/modules/auth/client";
import { activeProjectFor } from "@/modules/clients";
import { intakeProgress } from "@/modules/intake/progress";
import { forProject as day30For, isUnlocked as day30Unlocked } from "@/modules/day30";
import { tellDay30Due } from "@/modules/notifications/client";
import { invoiceToClientView, updateToClientView } from "@/modules/serializers";
import { sentForProject } from "@/modules/updates";
import { CodeScreen } from "./CodeScreen";

/**
 * The client home (items 1 to 5). It leads with the one thing we are waiting
 * on the client for, as a plain task with an instruction and one action, or a
 * calm "here is where things stand" when the ball is in our court. The journey
 * row says where they are; the record is folded below; a person is one tap
 * away in the header. Never a screen without a next step or an explanation.
 *
 * A delivered project has one card, "Delivered on [date]", which carries the
 * thank-you ask until it has been seen (F-12). A cancelled project says it
 * was closed, with the date, and asks for nothing (D-01).
 */
export default async function ProjectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await resolveClient(token);
  if (!client) {
    if (token === "me") redirect("/p/login");
    notFound();
  }

  const session = await currentClientSession(client.id);
  if (!session) {
    if (token === "me") redirect("/p/login");
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

  const ended = phase === Phase.CANCELLED || phase === Phase.CLOSED;
  const day30Due = !ended && day30 !== null && day30Unlocked(day30) && day30.metricAfterSubmittedAt === null;
  // The month-on page has opened: say so once, in the portal and by email.
  // There is no scheduler; the first render after the unlock is the moment.
  if (day30Due) await tellDay30Due(client.id);

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
  const standing = standingStatus(phase, { ...facts, endedOn: project?.cancelledAt ? dayMonthYear(project.cancelledAt) : undefined });
  const delivered = phase === Phase.DELIVERED || phase === Phase.CLOSED;
  const unpaid = invoices.filter((i) => i.status === "ISSUED").length;

  return (
    <ClientShell businessName={client.businessName} nav={{ token, clientId: client.id, current: "home" }}>
      <div style={{ padding: "22px 20px 16px" }} className="stack">
        <p className="k">{project ? "Your project" : "Your page"}</p>
        <h1 className="c-title" style={{ fontSize: 26, marginTop: 8 }}>{project ? project.name : client.businessName}</h1>
        {journey && <Journey state={journey} />}
      </div>

      <div style={{ padding: "0 20px", gap: 12 }} className="stack">
        {task ? (
          <ToDo token={token} task={task} />
        ) : delivered ? null : (
          <Standing title={standing.title} detail={standing.detail} />
        )}

        {phase === Phase.BUILDING && latest && (
          <div className="card">
            <div className="card-h open" style={{ display: "block" }}>
              <p className="k ember">{project?.weekCount ? `Week ${latest.weekNumber} of ${project.weekCount}` : `Week ${latest.weekNumber}`}</p>
              <p className="help" style={{ marginTop: 6 }}>Sent {latest.sentAt}</p>
            </div>
            <div className="card-b"><WeeklyUpdate update={latest} full /></div>
          </div>
        )}

        {delivered && project && (
          <div className={`card stand${!task && !project.thanksSeenAt ? " now" : ""}`}>
            <p className="k ember">Delivered on {dayMonthYear(project.deliveredAt)}</p>
            <h2>{phase === Phase.CLOSED ? "Done, and closed" : "It is done"}</h2>
            {project.afterDelivery === "RETAINER" ? (
              <>
                <p>{project.retainerNamedPerson ? `${project.retainerNamedPerson} is your person from here.` : "We run it monthly from here."}{project.retainerResponseTime ? ` You will hear back within ${project.retainerResponseTime.toLowerCase()}.` : ""}</p>
                {project.retainerTier && <p className="help">{project.retainerTier}</p>}
              </>
            ) : project.afterDelivery === "HANDOVER" ? (
              <>
                <p>Everything is documented and every access is yours.</p>
                {project.handoverDocUrl && <a className="btn-full ghost" href={project.handoverDocUrl} target="_blank" rel="noopener">Open the handover document</a>}
              </>
            ) : (
              <p>{agreement?.afterDeliveryOffer || "Rahul will confirm what happens from here."}</p>
            )}
            {!task && !project.thanksSeenAt && (
              <>
                <p>Two optional lines, if you would like to: how this went, in your words, and anyone you know with the same problem.</p>
                <Link className="btn-full" href={`/p/${token}/thanks`}>Say how it went</Link>
              </>
            )}
          </div>
        )}

        {/* The record, folded below. */}
        <div className="stack" style={{ marginTop: 8 }}>
          {updates.length > 1 && (
            <Fold title="Earlier weeks" fact={String(updates.length - 1)}>
              {updates.slice(1).map((u) => (
                <details key={u.id} className="pushback" style={{ borderTop: "none", paddingTop: 0, marginTop: 0 }}>
                  <summary>Week {u.weekNumber}, {u.sentAt}</summary>
                  <div style={{ paddingTop: 10 }}><WeeklyUpdate update={u} full /></div>
                </details>
              ))}
            </Fold>
          )}

          {intake?.submittedAt && phase !== Phase.INTAKE && (
            <Fold title="What you told us" fact={`sent ${dayMonthYear(intake.submittedAt)}`}>
              <Link className="btn-full ghost" href={`/p/${token}/intake`}>Read it back</Link>
            </Fold>
          )}

          {agreement?.sentAt && phase !== Phase.AGREEMENT_SENT && (
            <Fold title="Your agreement" fact={agreement.agreedAt ? `agreed ${dayMonthYear(agreement.agreedAt)}` : "being changed"}>
              <Link className="btn-full ghost" href={`/p/${token}/agreement`}>Read it again</Link>
            </Fold>
          )}

          {invoices.length > 0 && (
            <Fold title={invoices.length === 1 ? "Your invoice" : "Your invoices"} fact={unpaid === 0 ? "all paid" : unpaid === 1 ? "1 to pay" : `${unpaid} to pay`}>
              <InvoiceList invoices={invoices.map(invoiceToClientView)} />
            </Fold>
          )}

          <Fold title="How this works">
            <ol className="how">
              <li><b>Agree the shape.</b> You read one page, what we will build and how you will check it, and agree to it once. Nothing is invoiced until you do.</li>
              <li><b>Something you can open.</b> By about day ten there is a real link, not a screenshot. It will be rough, and that is the point.</li>
              <li><b>The build.</b> A short written update here every week, and a call every two weeks that either of us can book.</li>
              <li><b>Delivery.</b> You check the work against what you agreed to. If something is off, you say so and we keep going. When it holds, you sign off and we invoice the balance.</li>
            </ol>
          </Fold>
        </div>
      </div>
    </ClientShell>
  );
}

function ToDo({ token, task }: { token: string; task: PendingTask }) {
  return (
    <div className="card now todo">
      <div className="todo-head">
        {/* Ayush's word for it, 12 Sep. Singular on purpose: the phases are
            sequential, so there is never more than one. */}
        <p className="k ember">Pending task</p>
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
