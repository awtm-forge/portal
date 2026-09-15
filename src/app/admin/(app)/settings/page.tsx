import { AdminShell } from "@/components/admin/AdminShell";
import { Confirm } from "@/components/ui/Confirm";
import { dayMonth } from "@/lib/dates";
import { listAdmins, requireAdmin } from "@/modules/auth/admin";
import { rehearsalCounts, START_CLEAN_PHRASE } from "@/modules/clients/rehearsal";
import { company, liveSince } from "@/modules/settings";
import { markLiveAction, startCleanAction } from "./actions";
import { SettingsForm } from "./SettingsForm";
import { InviteAdmin } from "./InviteAdmin";

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const [c, admins, live] = await Promise.all([company(), listAdmins(), liveSince()]);
  // The rehearsal card (ADR 0023): the clean start while nothing is real, and
  // the one-way switch that ends it. Counts so the dialog says what goes.
  const counts = live ? null : await rehearsalCounts();
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  const tally = counts
    ? `${n(counts.clients, "client", "clients")}, ${n(counts.projects, "project", "projects")}, ${n(counts.signoffs, "sign-off", "sign-offs")} and ${n(counts.invoices, "invoice", "invoices")}`
    : "";
  return (
    <AdminShell active="settings" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="a-title">Settings</h1>
        <p className="a-sub">Your details, not a client&rsquo;s. These appear on every invoice and agreement.</p>
      </div>
      <SettingsForm company={c} />
      <InviteAdmin admins={admins.map((a) => ({ email: a.email, name: a.name, hasPassword: a.passwordHash !== null }))} />

      <div className="a-card">
        <span className="k">{live ? "Live" : "Rehearsal"}</span>
        {live || !counts ? (
          <p className="help" style={{ lineHeight: 1.65 }}>
            Live since {dayMonth(live ?? new Date())}. Nothing that is evidence can be removed now: a sign-off, an invoice, a review round, or a client who has any of them.
          </p>
        ) : (
          <>
            <p className="help" style={{ lineHeight: 1.65 }}>
              Until you say the portal is live, everything in it counts as rehearsal: {tally} right now. Start clean erases all of it in one go and starts the invoice numbering again at 0001; your logins, these settings and the image library stay. Mark it live once the first real client is in, and Start clean is gone for good.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Confirm
                trigger="Start clean"
                triggerClass="a-btn ghost"
                title="Erase every client?"
                line={`${tally}: all of it goes, and there is no way back. Your logins, these settings and the image library stay.`}
                confirmLabel="Erase every client"
                keepLabel="Keep everything"
                action={startCleanAction}
              >
                <label className="stack" style={{ gap: 6 }}>
                  <span className="lbl">Type &ldquo;{START_CLEAN_PHRASE}&rdquo;</span>
                  <input className="a-fld" name="phrase" maxLength={40} autoComplete="off" required />
                </label>
                <label className="stack" style={{ gap: 6 }}>
                  <span className="lbl">Why, in a line. It is the one thing that survives.</span>
                  <input className="a-fld" name="reason" maxLength={300} required />
                </label>
                <label className="stack" style={{ gap: 6 }}>
                  <span className="lbl">Your password</span>
                  <input className="a-fld" type="password" name="password" autoComplete="current-password" required />
                </label>
              </Confirm>
              <Confirm
                trigger="Mark the portal live"
                triggerClass="a-btn ghost"
                title="Mark the portal live?"
                line="This cannot be undone. Start clean disappears, and from then on nothing that is evidence can be removed."
                confirmLabel="It is live"
                keepLabel="Not yet"
                action={markLiveAction}
              >
                <label className="stack" style={{ gap: 6 }}>
                  <span className="lbl">Your password</span>
                  <input className="a-fld" type="password" name="password" autoComplete="current-password" required />
                </label>
              </Confirm>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
