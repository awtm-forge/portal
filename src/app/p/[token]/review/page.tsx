import { redirect } from "next/navigation";
import { ClientShell } from "@/components/portal/ClientShell";
import { StickyAction } from "@/components/ui/StickyAction";
import { Phase } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { projectScope } from "../scope";
import { roundsForProject } from "@/modules/review";
import { agreementToClientView, reviewRoundToClientView } from "@/modules/serializers";
import { ReviewControls } from "./ReviewControls";

/**
 * PORTAL-SPEC 6.4. What they agreed to, each with how they check it, then one
 * box and one button.
 */
export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { client, project } = await projectScope(token);

  const agreement = await db.agreement.findUnique({ where: { projectId: project.id } });
  if (!agreement?.agreedAt) redirect(`/p/${token}`);

  const rounds = (await roundsForProject(project.id)).map(reviewRoundToClientView);
  const current = rounds.find((r) => r.outcome === "OPEN") ?? null;
  const earlier = rounds.filter((r) => r.outcome !== "OPEN");
  const view = agreementToClientView(agreement);
  const open = project.phase === Phase.IN_REVIEW && current !== null;

  return (
    <ClientShell businessName={client.businessName} nav={{ token, clientId: client.id, current: "review" }}>
      <div style={{ padding: "24px 0 18px" }} className="stack">
        <p className="k">{open ? "Ready for you to check" : "The review"}</p>
        <h1 className="c-title" style={{ marginTop: 10 }}>{project.name}</h1>
        <p className="c-sub" style={{ marginTop: 10 }}>
          {open
            ? "Here is what you agreed to, and how to check each one yourself. Take your time. Nothing is invoiced until you are happy."
            : "We are working on what you sent back. It comes to you again when it is ready."}
        </p>
      </div>

      <section className="doc-sec" style={{ padding: "0" }}>
        <h2>What you agreed to</h2>
        <ul className="deliverables">
          {view.deliverables.map((d) => (
            <li key={d.key}>
              <span className="d-text">{d.text}</span>
              {d.how_to_check && <span className="d-check">How you check it: {d.how_to_check}</span>}
            </li>
          ))}
        </ul>
      </section>

      {current && (
        <div style={{ padding: "18px 0 0" }} className="stack">
          <a className="btn-full ghost" href={current.finishedWorkUrl} target="_blank" rel="noopener">Open the finished work ↗</a>
          <p className="help" style={{ textAlign: "center", marginTop: 8 }}>It opens in a new tab. Come back here to say how it went.</p>
        </div>
      )}

      {open && (
        <div id="review-choice" tabIndex={-1} style={{ marginTop: 22, outline: "none" }}>
          <ReviewControls token={token} signoffPersonName={project.signoffPersonName} />
        </div>
      )}
      {/* Both choices, kept within reach while they read (F-05). The bar scrolls to them; it never signs off for them. */}
      {open && <StickyAction targetId="review-choice" label="Say how it went" hint="Checked it? Then" />}

      {earlier.length > 0 && (
        <div style={{ padding: "22px 0 0" }}>
          <details className="pushback">
            <summary>{earlier.length === 1 ? "The round before this" : `Earlier rounds, ${earlier.length}`}</summary>
            <div className="stack" style={{ gap: 14, paddingTop: 12 }}>
              {earlier.map((r) => (
                <div className="stack" style={{ gap: 5 }} key={r.id}>
                  <span className="k">Round {r.roundNumber}, {r.sentAt}</span>
                  <p className="help">{r.outcomeLabel}{r.respondedAt ? ` on ${r.respondedAt}` : ""}</p>
                  {r.clientNote && <p className="c-sub" style={{ whiteSpace: "pre-wrap", color: "var(--ink)" }}>{r.clientNote}</p>}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </ClientShell>
  );
}
