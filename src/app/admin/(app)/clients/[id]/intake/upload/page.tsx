import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/modules/auth/admin";
import { withIntake } from "@/modules/clients";
import { readAnswers } from "@/modules/intake/answers";
import { UploadForm } from "./UploadForm";

/** "Send the questionnaire" (Q12). The client already has their link; this puts something on it. */
export default async function UploadQuestionnairePage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const client = await withIntake(id);
  if (!client) notFound();
  const answerCount = client.intake ? Object.keys(readAnswers(client.intake.answers)).length : 0;
  return (
    <AdminShell active="clients" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="a-title">{client.intake ? "Replace the questionnaire" : "Send the questionnaire"}</h1>
        <p className="a-sub">{client.businessName} · {client.intake ? `${answerCount} answers so far` : "nothing on their page yet"}</p>
      </div>
      <UploadForm clientId={client.id} hasAnswers={answerCount > 0} firstTime={client.intake === null} linkSent={client.linkEmailedAt !== null} />
    </AdminShell>
  );
}
