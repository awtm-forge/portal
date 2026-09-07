import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientShell } from "@/components/portal/ClientShell";
import { currentClientSession, projectByToken } from "@/modules/auth/client";
import { intakeProgress } from "@/lib/intake/progress";
import { CodeScreen } from "./CodeScreen";

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

  const intake = project.intake;
  return (
    <ClientShell businessName={project.client.businessName}>
      <div style={{ padding: "22px 20px 18px" }} className="stack">
        <p className="k">Your project</p>
        <h1 className="c-title" style={{ fontSize: 26, marginTop: 9 }}>{project.name}</h1>
      </div>
      <div style={{ padding: "0 20px", marginTop: 8 }}>
        {!intake && (
          <div className="card" style={{ padding: "18px 16px" }}>
            <div className="stack" style={{ gap: 10 }}>
              <span className="sec-name" style={{ fontSize: 17 }}>Nothing to do yet</span>
              <p className="c-sub">Rahul is writing your questionnaire from the call. It appears here when it is ready, and we will message you on WhatsApp.</p>
            </div>
          </div>
        )}
        {intake && intake.submittedAt && (
          <div className="card" style={{ padding: "18px 16px" }}>
            <div className="stack" style={{ gap: 12 }}>
              <span className="sec-name" style={{ fontSize: 17 }}>Sent on {formatDate(intake.submittedAt)}. Thank you.</span>
              <p className="c-sub">We are writing the agreement from your answers. It appears here when it is ready, and we will message you.</p>
              <Link className="btn-full ghost" href={`/p/${token}/intake`} style={{ marginTop: 4 }}>Look at your answers</Link>
            </div>
          </div>
        )}
        {intake && !intake.submittedAt && (() => {
          const p = intakeProgress(intake.document, intake.answers, intake.sectionsDone);
          return (
            <div className="card now" style={{ padding: "18px 16px" }}>
              <div className="stack" style={{ gap: 12 }}>
                <p className="k ember">Now</p>
                <span className="sec-name" style={{ fontSize: 19, lineHeight: 1.2 }}>Before we start, about ten minutes</span>
                <p className="c-sub">
                  {p.total} short sections. It saves as you type, so you can leave and come back.
                  {p.done > 0 ? ` You are ${p.done} of ${p.total} sections in.` : ""}
                </p>
                <Link className="btn-full" href={`/p/${token}/intake`} style={{ marginTop: 4 }}>
                  {p.done > 0 ? "Carry on with the questionnaire" : "Open the questionnaire"}
                </Link>
              </div>
            </div>
          );
        })()}
      </div>
    </ClientShell>
  );
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(d);
}
