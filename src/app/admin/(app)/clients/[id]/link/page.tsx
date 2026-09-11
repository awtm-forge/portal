import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { Confirm } from "@/components/ui/Confirm";
import { Fold } from "@/components/ui/Fold";
import { dayMonth } from "@/lib/dates";
import { requireAdmin } from "@/modules/auth/admin";
import { byId } from "@/modules/clients";
import { clientUrl } from "@/lib/request-origin";
import { questionnaireReadyMessage, waLink } from "@/lib/whatsapp";
import { resendLinkAction, rotateLinkAction, takeFlashLink } from "../../../actions";
import { CopyLink } from "../CopyLink";

/**
 * The handover. Its own screen because this is the only moment the link can
 * ever be shown: only a hash of it is stored (PORTAL-SPEC 5.9).
 */
export default async function SendLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const client = await byId(id);
  if (!client) notFound();

  const token = await takeFlashLink(client.id);
  const link = token ? await clientUrl(`/p/${token}`) : null;
  const c = client;
  const firstName = c.contactName.trim().split(/\s+/)[0] || c.contactName;
  const message = link ? questionnaireReadyMessage({ contactName: firstName, link }) : "";

  return (
    <AdminShell active="clients" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <span className="k ember">Client added</span>
        <h1 className="a-title">Send {firstName} their link</h1>
        <p className="a-sub">{client.businessName}</p>
      </div>

      <div className="a-cols">
        <div className="main">
          {link ? (
            <div className="a-card ember">
              <span className="k ember">Their link, shown once</span>
              <div className="a-fld mono" style={{ fontSize: 15, color: "var(--ink)", wordBreak: "break-all", padding: "14px 16px", background: "var(--surface-2)" }}>{link}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <CopyLink link={link} />
                <a className="a-btn ghost" href={waLink(c.contactPhone, message)} target="_blank" rel="noopener">Send it on WhatsApp</a>
              </div>
              <p className="help" style={{ lineHeight: 1.65 }}>
                Only a hash of this link is stored, so this is the one screen that can show it. Copy it now if you want it anywhere else. If you lose it, rotate below and a new one appears here.
              </p>
            </div>
          ) : (
            <div className="a-card">
              <span className="k">The link is not in hand</span>
              <p className="c-sub" style={{ fontSize: 14 }}>
                It was shown when the client was added and only its hash was kept, so it cannot be shown again. Rotate it to make a new one, which stops the old link working at once.
              </p>
              <div>
                <Confirm
                  trigger="Make a new link"
                  triggerClass="a-btn"
                  title="Make a new link?"
                  line={`The link ${firstName} has stops working the moment this runs. The new one is shown once, here, and emailed to ${client.contactEmail}. Their signed-in phone stays signed in.`}
                  confirmLabel="Make the new link"
                  action={rotateLinkAction}
                >
                  <input type="hidden" name="clientId" value={client.id} />
                </Confirm>
              </div>
            </div>
          )}

          {link && (
            <div className="a-card">
              <div className="between"><span className="k">The WhatsApp message, ready to send</span><span className="help">Opens WhatsApp with this written</span></div>
              <div style={{ border: "1px solid var(--rule)", background: "var(--surface-2)", borderRadius: 2, padding: "14px 16px", fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", color: "var(--ink)" }}>{message}</div>
              <p className="help">Edit it in WhatsApp before you send if you want to. Nothing here is sent for you.</p>
            </div>
          )}

          <div className={`a-card${client.linkEmailError ? " ember" : ""}`}>
            <div className="between">
              <span className={`k${client.linkEmailError ? " ember" : ""}`}>The email</span>
              <span className="mono-sm">{client.linkEmailedAt ? `Sent ${dayMonth(client.linkEmailedAt)}` : client.linkEmailError ? "Not sent" : "Not sent yet"}</span>
            </div>
            <div className="stack">
              <div className="between" style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}>
                <span>To {client.contactEmail}</span><span className="help">the contact address</span>
              </div>
              <div className="between" style={{ padding: "9px 0" }}>
                <span>Your awtm forge page, {client.businessName}</span>
              </div>
            </div>
            {client.linkEmailError ? (
              <form action={resendLinkAction} className="stack" style={{ gap: 8 }}>
                <input type="hidden" name="clientId" value={client.id} />
                <p className="help err">It did not go out. The client was still added, and nothing is lost by trying again.</p>
                <div><button className="a-btn" type="submit">Try sending it again</button></div>
              </form>
            ) : (
              <p className="help" style={{ lineHeight: 1.65 }}>
                It goes out on its own when you send the questionnaire, or when the first project starts, whichever comes first. Both go out then: the email is the record, the WhatsApp message is the one they will actually read.
              </p>
            )}
          </div>
        </div>

        <div className="aside">
          <div className="a-card">
            <span className="k">Next</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link className="a-btn" href={`/admin/clients/${client.id}/intake/upload`}>Upload the questionnaire</Link>
              <Link className="a-btn ghost" href={`/admin/clients/${client.id}`}>Back to the client</Link>
            </div>
          </div>
          <Fold card title="What they will see">
            <p className="c-sub" style={{ fontSize: 14 }}>No password, no username, no account to set up. The link is the way in and the code confirms the device.</p>
            <p className="help" style={{ lineHeight: 1.9 }}>
              They open the link on a phone.<br />
              It offers to email them a code.<br />
              The code lands with {client.contactName}.<br />
              They type it once.<br />
              That phone stays signed in for thirty days.<br />
              Then: nothing to do yet, until the questionnaire is up.
            </p>
            <p className="help" style={{ lineHeight: 1.65 }}>
              If a client asks you for their password, the honest answer is that there is not one, and that is deliberate: a password we never hold is a password that cannot leak.
            </p>
          </Fold>
        </div>
      </div>
    </AdminShell>
  );
}
