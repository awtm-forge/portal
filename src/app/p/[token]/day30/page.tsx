import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientShell } from "@/components/portal/ClientShell";
import { projectScope } from "../scope";
import { draftTextForClient, forProject, isUnlocked, markOpened } from "@/modules/day30";
import { day30ToClientView } from "@/modules/serializers";
import { Day30Form } from "./Day30Form";

/**
 * PORTAL-SPEC 6.5 and acceptance criterion 10. Locked until `unlocks_at`, and
 * the lock is a comparison made here on read: nothing is scheduled, so nothing
 * can fail to fire, and a process asleep for a month wakes with the right
 * answer.
 *
 * Before the date it is a 404 rather than a "come back later" page, because
 * the client has no reason to know this page exists until it is theirs to
 * fill in. The project page shows the way in on the day.
 */
export default async function Day30Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { client, project } = await projectScope(token);

  const row = await forProject(project.id);
  if (!row || !isUnlocked(row)) notFound();

  await markOpened(project.id);
  const view = day30ToClientView(row, project);
  const draft = view.answered ? "" : await draftTextForClient(project.id);

  return (
    <ClientShell businessName={client.businessName} nav={{ token, clientId: client.id, current: "day30" }}>
      <div style={{ padding: "38px 20px 20px" }} className="stack">
        <p className="k ember">One month on</p>
        <h1 className="c-title" style={{ marginTop: 10 }}>Two things, under a minute.</h1>
        <p className="c-sub" style={{ marginTop: 10 }}>
          {view.answered
            ? "You have already answered this. Nothing else is needed, and thank you."
            : "We ask once, a month after delivery, and then we leave you alone."}
        </p>
      </div>

      {view.answered ? (
        <div style={{ padding: "0 20px" }}>
          <Link className="btn-full ghost" href={`/p/${token}`}>Back to your project</Link>
        </div>
      ) : (
        <Day30Form token={token} view={view} draft={draft} />
      )}
    </ClientShell>
  );
}
