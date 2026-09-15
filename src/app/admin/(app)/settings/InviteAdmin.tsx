"use client";

import { useActionState } from "react";
import { Confirm } from "@/components/ui/Confirm";
import { inviteAdminAction, removeAccessAction, removeAdminAction, type InviteState } from "./adminActions";

type Existing = { email: string; name: string; hasPassword: boolean; accessRemoved: boolean; isOwner: boolean };

/**
 * The team, and how someone joins it.
 *
 * The form used to sit behind a folded grey summary that read as a caption
 * rather than a control, which is the third time that mistake has been made
 * on this codebase (Ayush, 14 Sep). It is open on the page now, with the three
 * steps written out beside it, because the thing that makes this flow
 * confusing is not the form, it is not knowing that we never set anybody's
 * password.
 *
 * Each seat carries its own button (Ayush, 15 Sep). And there is an owner
 * now, named by OWNER_EMAIL, who is the one person who adds admins, reissues
 * their links and takes access away; there is no limit on how many (ADR 0024).
 * Everyone else sees the team and nothing to press.
 */
const STEPS = [
  { what: "You make a setup link here", note: "Nothing is emailed and no password is set." },
  { what: "You send it to them yourself", note: "WhatsApp, a message, however you already talk." },
  { what: "They open it and choose a password", note: "Only they ever see it. It works once and lasts 48 hours." },
];

export function InviteAdmin({
  admins,
  canManage,
  ownerName,
  meEmail,
}: {
  admins: Existing[];
  /** The owner, or anyone while no owner is named. */
  canManage: boolean;
  /** Who to name when someone else asks why they cannot. Null while no owner is named. */
  ownerName: string | null;
  meEmail: string;
}) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteAdminAction, {});
  const v = state.values;
  const waiting = admins.filter((a) => !a.hasPassword && !a.accessRemoved);

  return (
    <div className="a-card">
      <span className="k">The team</span>

      <div className="stack">
        {admins.map((a) => (
          <div className="between" key={a.email} style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)", flexWrap: "wrap" }}>
            <span className="stack" style={{ gap: 2 }}>
              <span style={{ fontSize: 14.5 }}>
                {a.name}
                {a.isOwner && <span className="tag" style={{ marginLeft: 8, color: "var(--accent)" }}>owner</span>}
                {a.email === meEmail && !a.isOwner && <span className="tag" style={{ marginLeft: 8 }}>you</span>}
              </span>
              <span className="mono-sm">{a.email}</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span className="tag" style={{ color: a.hasPassword ? "var(--muted)" : a.accessRemoved ? "var(--faint)" : "var(--accent)" }}>
                {a.hasPassword ? "can sign in" : a.accessRemoved ? "access removed" : "link not used yet"}
              </span>
              {canManage && (
                <>
                  {/* The same action as the form, with this seat's details
                      already in it. A reissued link does not touch the
                      password they have; it lets them choose a new one. */}
                  <form action={action}>
                    <input type="hidden" name="email" value={a.email} />
                    <input type="hidden" name="name" value={a.name} />
                    <button className="a-btn ghost" type="submit" disabled={pending} style={{ minHeight: 32, padding: "6px 12px" }}>
                      {a.hasPassword ? "Reset their password" : a.accessRemoved ? "Give access again" : "Reissue their setup link"}
                    </button>
                  </form>
                  {a.hasPassword && !a.isOwner && a.email !== meEmail && (
                    <Confirm
                      trigger="Remove access"
                      triggerClass="link-mono"
                      title={`Remove ${a.name}'s access?`}
                      line="They are signed out everywhere and can no longer sign in. What they uploaded and decided stays on the record, and you can give them access again later from here."
                      confirmLabel="Remove their access"
                      keepLabel="Keep them"
                      action={removeAccessAction}
                    >
                      <input type="hidden" name="email" value={a.email} />
                    </Confirm>
                  )}
                  {!a.hasPassword && !a.accessRemoved && (
                    <form action={removeAdminAction}>
                      <input type="hidden" name="email" value={a.email} />
                      <button className="link-mono" type="submit" style={{ padding: 0, fontSize: "10.5px", color: "var(--faint)" }}>Remove</button>
                    </form>
                  )}
                </>
              )}
            </span>
          </div>
        ))}
      </div>

      {state.link ? (
        <div className="stack" style={{ gap: 8, paddingTop: 6 }}>
          <span className="k ember">Setup link for {state.email}</span>
          <code className="mono-sm" style={{ wordBreak: "break-all", padding: "10px 12px", border: "1px solid var(--rule)", borderRadius: 2, display: "block" }}>
            {state.link}
          </code>
          <p className="help" style={{ lineHeight: 1.65 }}>
            Shown once, works once, lasts 48 hours. Send it to them now: this page cannot show it again, and if it is lost you make another one from their seat above, which stops this one working.
          </p>
        </div>
      ) : (
        <div className="stack" style={{ gap: 14, paddingTop: 8, borderTop: "1px solid var(--rule-soft)" }}>
          <div className="stack" style={{ gap: 3 }}>
            <span className="sec-name">{canManage ? "Adding an admin" : "Who manages the team"}</span>
            <p className="help" style={{ lineHeight: 1.65 }}>
              {canManage
                ? "As many as you need. We never set anyone's password, so this makes a link instead. To reissue a link, reset a password or remove access, use the buttons beside that seat above."
                : `Only ${ownerName ?? "the owner"} adds admins, reissues their links or removes access. Ask them.`}
            </p>
          </div>

          {canManage && (
            <ol className="a-steps">
              {STEPS.map((s, i) => (
                <li key={s.what}>
                  <span className="a-step-n">{i + 1}</span>
                  <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                    <span className="a-step-w">{s.what}</span>
                    <span className="help">{s.note}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}

          {waiting.length > 0 && (
            <p className="help">
              {waiting.length === 1 ? `${waiting[0].name} has a link and has not used it yet.` : `${waiting.length} links are out and none has been used yet.`}
            </p>
          )}

          {state.message && <p className="help err">{state.message}</p>}

          {canManage && (
            <form action={action} className="stack" style={{ gap: 10 }}>
              <div className="grid2">
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Email</span><input className="a-fld" type="email" name="email" maxLength={200} defaultValue={v?.email} required /></label>
                <label className="stack" style={{ gap: 6 }}><span className="lbl">Name</span><input className="a-fld" name="name" maxLength={120} defaultValue={v?.name} required /></label>
              </div>
              <div>
                {/* Outlined, not filled: Save settings is this page's one loud
                    action. The old mistake was a grey text link, not an outline. */}
                <button className="a-btn ghost" type="submit" disabled={pending}>
                  {pending ? "Making the link" : "Add an admin"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
