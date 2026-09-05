import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/admin-auth";
import { NewProjectForm } from "./NewProjectForm";

export default async function NewProjectPage() {
  const admin = await requireAdmin();
  return (
    <AdminShell active="projects" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="a-title">New project</h1>
        <p className="a-sub">After the discovery call. Creates the client link. Nothing goes to the client until you send it.</p>
      </div>
      <NewProjectForm />
    </AdminShell>
  );
}
