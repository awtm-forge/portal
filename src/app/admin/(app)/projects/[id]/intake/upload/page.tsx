import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/modules/auth/admin";
import { db } from "@/lib/db";
import { readAnswers } from "@/modules/intake/answers";
import { UploadForm } from "./UploadForm";

export default async function UploadQuestionnairePage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id }, include: { client: true, intake: { select: { answers: true } } } });
  if (!project) notFound();
  const answerCount = project.intake ? Object.keys(readAnswers(project.intake.answers)).length : 0;
  return (
    <AdminShell active="projects" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="a-title">{project.intake ? "Replace questionnaire" : "Upload questionnaire"}</h1>
        <p className="a-sub">{project.name} · {project.client.businessName} · {project.intake ? `${answerCount} answers so far` : "no questionnaire yet"}</p>
      </div>
      <UploadForm projectId={project.id} hasAnswers={answerCount > 0} />
    </AdminShell>
  );
}
