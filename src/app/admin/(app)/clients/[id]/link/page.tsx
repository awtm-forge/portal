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
import { revealClientToken } from "@/modules/auth/client";
import { keepLinkAction, resendLinkAction, rotateLinkAction, takeFlashLink } from "../../../actions";
import { CopyLink } from "../CopyLink";

/**
 * The handover, and the one screen that can show a client their link.
 *
 * It used to be the one moment as well: only a hash was stored, so a link not
 * copied at the time was gone and the only way to send it again was to rotate,
 * which takes away the link the client already has to solve a problem that is
 * ours (Ayush, 14 Sep). A sealed copy of the same token is kept now, so the
 * same link can be read back and sent again (ADR 0021). A link minted before
 * that change is kept the first time the client opens it, and until then the
 * team can paste it from their sent mail or WhatsApp and it is kept at once
 * (Ayush, 15 Sep: the link should be there every time). Rotating is the last
 * resort here, not the suggestion.
 */
export default async function SendLinkPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const client = await byId(id);
  if (!client) notFound();

  // Freshly minted and riding the flash cookie, or read back from the sealed
  // copy. Either way it is the link the client holds right now.
  const justMade = await takeFlashLink(client.id);
  const token = justMade ?? (await revealClientToken(client.id));
  const link = token ? await clientUrl(`/p/${token}`) : null;
  const c = client;
  const firstName = c.contactName.trim().split(/\s+/)[0] || c.contactName;
  const message = link ? questionnaireReadyMessage({ contactName: firstName, link }) : "";

  return (
    <AdminShell active="clients" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <span className={`k${justMade ? " ember" : ""}`}>{justMade ? "Client added" : "Their way in"}</span>
        <h1 className="a-title">Send {firstName} their link</h1>
        <p className="a-sub">{client.businessName}</p>
      </div>

      <div className="a-cols">
        <div className="main">
          {link ? (
            <div className="a-card ember">
              <span className="k ember">Their link</span>
              <div className="a-fld mono" style={{ fontSize: 15, color: "var(--ink)", wordBreak: "break-all", padding: "14px 16px", background: "var(--surface-2)" }}>{link}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <CopyLink link={link} />
                <a className="a-btn ghost" href={waLink(c.contactPhone, message)} target="_blank" rel="noopener">Send it on WhatsApp</a>
              </div>
              <p className="help" style={{ lineHeight: 1.65 }}>
                This is the link {firstName} holds right now, and this page can show it again whenever you need it. Sending it again changes nothing for them. Rotating, below, is the other thing: it makes a new link and stops this one working.
              </p>
            </div>
          ) : (
            <div className="a-card ember">
              <span className="k ember">This link cannot be shown yet</span>
              <p className="c-sub" style={{ fontSize: 14 }}>
                It was minted before we kept a copy we could read back, so only its hash exists. {firstName}&apos;s link still works. The copy is kept the next time they open it, and this page shows it from then on. If you have it now, from your sent mail or the WhatsApp message, paste it here and it is kept at once.
              </p>
              <form action={keepLinkAction} className="stack" style={{ gap: 10 }}>
                <input type="hidden" name="clientId" value={client.id} />
                <label className="stack" style={{ gap: 6 }}>
                  <span className="lbl">Their link, pasted</span>
                  <input className="a-fld mono" name="link" maxLength={600} placeholder="https://dashboard.awtmforge.com/p/..." autoComplete="off" required />
                </label>
                <div><button className="a-btn" type="submit">Keep this link</button></div>
              </form>
              <p className="help" style={{ lineHeight: 1.65 }}>It is checked against what we hold before it is kept, so a wrong paste, or another client&apos;s link, changes nothing.</p>
              <div style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 14 }} className="stack">
                <p className="help" style={{ lineHeight: 1.65 }}>
                  Or make a new link, which stops the one {firstName} has working the moment it runs. Use it when a link has gone somewhere it should not have, not to get one onto this page.
                </p>
                <div>
                  <Confirm
                    trigger="Make a new link"
                    triggerClass="a-btn ghost"
                    title="Make a new link?"
                    line={`The link ${firstName} has stops working the moment this runs. The new one is shown once, here, and emailed to ${client.contactEmail}. Their signed-in phone stays signed in.`}
                    confirmLabel="Make the new link"
                    action={rotateLinkAction}
                  >
                    <input type="hidden" name="clientId" value={client.id} />
                  </Confirm>
                </div>
              </div>
            </div>
          )}

          {link && (
            <div className="a-card">
              <div className="between"><span className="k">The WhatsApp message, ready to send</span><span className="help">Opens WhatsApp with this written</span></div>
              <div /* The link is one long unbroken word, so this has to be allowed to break
                   inside it or the page scrolls sideways on a phone (14 Sep). */
                style={{ border: "1px solid var(--rule)", background: "var(--surface-2)", borderRadius: 2, padding: "14px 16px", fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: "var(--ink)" }}>{message}</div>
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
