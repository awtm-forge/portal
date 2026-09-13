import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClientShell } from "@/components/portal/ClientShell";
import { HowThisWorks } from "@/components/portal/HowThisWorks";
import { InvoiceList } from "@/components/portal/InvoiceList";
import { journeyFor } from "@/components/portal/Journey";
import { ProgressRail } from "@/components/portal/ProgressRail";
import { StatusCard } from "@/components/portal/StatusCard";
import { WeeklyUpdate } from "@/components/portal/WeeklyUpdate";
import { fill, homeStateFor } from "@/content/client-home";
import { Fold } from "@/components/ui/Fold";
import { Phase } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { dayMonthYear, isTodayOrLater, weekdayDate } from "@/lib/dates";
import { phoneDigits } from "@/lib/format";
import { currentClientSession, maskEmail, resolveClient } from "@/modules/auth/client";
import { activeProjectFor } from "@/modules/clients";
import { intakeProgress } from "@/modules/intake/progress";
import { forProject as day30For, isUnlocked as day30Unlocked } from "@/modules/day30";
import { tellDay30Due } from "@/modules/notifications/client";
import { roundsForProject } from "@/modules/review";
import { invoiceToClientView, updateToClientView } from "@/modules/serializers";
import { company } from "@/modules/settings";
import { sentForProject } from "@/modules/updates";
import { CodeScreen } from "./CodeScreen";

/**
 * The client home. Rebuilt 13 Sep from an audit of the live page at 1440.
 *
 * The order is the order of the questions a client actually has. Whose name is
 * on this and when it started, then where we are in the five stages, then the
 * hero: is anything needed from me, and what happens next. The record folds
 * below that, and how the whole thing works is open until they have been
 * through the first stage.
 *
 * Not one sentence about where things stand is written here. All of it lives
 * in src/content/client-home.ts, which a person can edit without opening a
 * component, and every date in it is a fact read from the database.
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

  const [agreement, invoices, updateRows, day30, rounds] = project
    ? await Promise.all([
        db.agreement.findUnique({ where: { projectId: project.id } }),
        db.invoice.findMany({ where: { projectId: project.id }, orderBy: { issuedAt: "asc" } }),
        sentForProject(project.id),
        day30For(project.id),
        roundsForProject(project.id),
      ])
    : [null, [], [], null, []];
  const c = await company();
  const whatsappReach = Boolean(c.phone.trim() && phoneDigits(c.phone));
  // The client asked for changes and we are making them: the newest round was
  // answered rather than accepted.
  const changesAsked = rounds[0]?.outcome === "CHANGES_REQUESTED";

  const ended = phase === Phase.CANCELLED || phase === Phase.CLOSED;
  const day30Due = !ended && day30 !== null && day30Unlocked(day30) && day30.metricAfterSubmittedAt === null;
  // The month-on page has opened: say so once, in the portal and by email.
  // There is no scheduler; the first render after the unlock is the moment.
  if (day30Due) await tellDay30Due(client.id);

  const updates = updateRows.map(updateToClientView);
  const latest = updates[0] ?? null;

  const day30Done = day30 !== null && day30.metricAfterSubmittedAt !== null;
  const journey = journeyFor(phase, { intakeSubmitted: Boolean(intake?.submittedAt), day30Done });

  // The one block of copy that is true right now, from the content file. The
  // page never writes a sentence of its own about where things stand.
  const copy = homeStateFor({
    phase,
    hasQuestionnaire: Boolean(intake),
    questionnaireSubmitted: Boolean(intake?.submittedAt),
    sectionsDone: progress?.done ?? 0,
    sectionsTotal: progress?.total ?? 0,
    hasProject: Boolean(project),
    agreementChangeAsked: phase === Phase.AGREEMENT_DRAFT && (agreement?.version ?? 1) > 1,
    deliveryChangeAsked: phase === Phase.BUILDING && changesAsked,
    day30Due,
    day30Done,
    checkinScheduled: day30 !== null && !day30Due && !day30Done,
    ended,
  });

  // Every date here is a fact that was read from the database. A template with
  // no value to fill drops its whole line rather than printing a gap.
  const expected = copy.expected
    ? fill(copy.expected, {
        date:
          copy.key === "month.waiting"
            ? weekdayDate(day30?.unlocksAt)
            : project?.expectedBy && isTodayOrLater(project.expectedBy)
              ? weekdayDate(project.expectedBy)
              : null,
      })
    : null;
  const headline = fill(copy.headline, { date: weekdayDate(project?.cancelledAt) }) ?? copy.headline;
  const body = fill(copy.body, { done: progress?.done ?? 0, total: progress?.total ?? 0 }) ?? copy.body;
  const channel = copy.chip === "waiting" && !copy.action
    ? whatsappReach
      ? "We will message you on WhatsApp when it is ready."
      : "We will email you when it is ready."
    : null;

  const delivered = phase === Phase.DELIVERED || phase === Phase.CLOSED;
  const unpaid = invoices.filter((i) => i.status === "ISSUED").length;
  const started = project?.kickoffAt ?? project?.createdAt ?? null;
  const moved = project?.lastMovedAt ?? null;

  return (
    <ClientShell businessName={client.businessName} nav={{ token, clientId: client.id, current: "home" }}>
      <div className="home-title">
        <p className="eyebrow">{project ? "Your project" : "Your page"}</p>
        <h1 className="home-name">{project ? project.name : client.businessName}</h1>
        {(started || moved) && (
          <p className="home-meta">
            {started && <span>Started {weekdayDate(started)}</span>}
            {started && moved && <span aria-hidden="true"> · </span>}
            {moved && <span>Last updated {weekdayDate(moved)}</span>}
          </p>
        )}
      </div>

      {journey && <ProgressRail now={journey.now} done={journey.done} />}

      <div className="home-main">
        <StatusCard
          chip={copy.chip}
          headline={headline}
          body={body}
          expected={expected}
          channel={channel}
          action={copy.action ? { label: copy.action.label, href: `/p/${token}${copy.action.path}` } : null}
        />

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
          <div className="card stand">
            <p className="k">Delivered on {dayMonthYear(project.deliveredAt)}</p>
            <h2>{phase === Phase.CLOSED ? "Done, and closed" : "What happens from here"}</h2>
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
            {!project.thanksSeenAt && (
              <>
                <p>Two optional lines, if you would like to: how this went, in your words, and anyone you know with the same problem.</p>
                <Link className="btn-full ghost" href={`/p/${token}/thanks`}>Say how it went</Link>
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

        </div>

        {/* Open until the questionnaire is behind them, then folded. Their
            choice after that, remembered on their device. */}
        <HowThisWorks clientKey={client.id} openByDefault={!intake?.submittedAt} />
      </div>
    </ClientShell>
  );
}
