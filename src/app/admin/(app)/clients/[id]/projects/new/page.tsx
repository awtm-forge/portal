import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { db } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/admin";
import { NewProjectForm } from "./NewProjectForm";

export default async function NewProjectForClientPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const client = await db.client.findUnique({ where: { id } });
  if (!client) notFound();

  return (
    <AdminShell active="clients" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="a-title">Start a project</h1>
        <p className="a-sub">For {client.businessName}. Creating it makes the link. It goes out on the next screen, not this one.</p>
      </div>
      <NewProjectForm
        client={{ id: client.id, businessName: client.businessName, contactName: client.contactName, contactEmail: client.contactEmail }}
      />
    </AdminShell>
  );
}
