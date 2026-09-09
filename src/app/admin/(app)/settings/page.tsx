import { AdminShell } from "@/components/admin/AdminShell";
import { listAdmins, requireAdmin } from "@/modules/auth/admin";
import { company } from "@/modules/settings";
import { SettingsForm } from "./SettingsForm";
import { InviteAdmin } from "./InviteAdmin";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const admin = await requireAdmin();
  const [c, params, admins] = await Promise.all([company(), searchParams, listAdmins()]);
  return (
    <AdminShell active="settings" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="a-title">Settings</h1>
        <p className="a-sub">Your details, not a client&rsquo;s. These appear on every invoice and agreement.</p>
      </div>
      <SettingsForm company={c} saved={params.saved === "1"} />
      <InviteAdmin admins={admins.map((a) => ({ email: a.email, name: a.name, hasPassword: a.passwordHash !== null }))} />
    </AdminShell>
  );
}
