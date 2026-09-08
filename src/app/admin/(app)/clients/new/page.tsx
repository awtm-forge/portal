import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/modules/auth/admin";
import { ClientForm } from "../ClientForm";

export default async function NewClientPage() {
  const admin = await requireAdmin();
  return (
    <AdminShell active="clients" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="a-title">Add a client</h1>
        <p className="a-sub">Straight after the discovery call. Nothing reaches them from this screen.</p>
      </div>
      <ClientForm />
    </AdminShell>
  );
}
