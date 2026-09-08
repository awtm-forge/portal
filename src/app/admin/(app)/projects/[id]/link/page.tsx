import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { db } from "@/lib/db";
import { dayMonth } from "@/lib/dates";
import { requireAdmin } from "@/modules/auth/admin";
import { projectLink } from "@/modules/auth/client";
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
  const project = await db.project.findUnique({ where: { id }, include: { client: true } });
  if (!project) notFound();

  const token = await takeFlashLink(project.id);
  const link = token ? projectLink(token) : null;
  const c = project.client;
  const firstName = c.contactName.trim().split(/\s+/)[0] || c.contactName;
  const message = link ? questionnaireReadyMessage({ contactName: firstName, link }) : "";

  return (
    <AdminShell active="projects" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <span className="k ember">Project created</span>
        <h1 className="a-title">Send {firstName} their link</h1>
        <p className="a-sub">{project.name} · {c.businessName}</p>
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
                It was shown when the project was made and only its hash was kept, so it cannot be shown again. Rotate it to make a new one, which stops the old link working at once.
              </p>
              <form action={rotateLinkAction}>
                <input type="hidden" name="projectId" value={project.id} />
                <button className="a-btn" type="submit">Make a new link</button>
              </form>
            </div>
          )}

          {link && (
            <div className="a-card">
              <div className="between"><span className="k">The WhatsApp message, ready to send</span><span className="help">Opens WhatsApp with this written</span></div>
              <div style={{ border: "1px solid var(--rule)", background: "var(--surface-2)", borderRadius: 2, padding: "14px 16px", fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-wrap", color: "var(--ink)" }}>{message}</div>
              <p className="help">Edit it in WhatsApp before you send if you want to. Nothing here is sent for you.</p>
            </div>
          )}

          <div className={`a-card${project.linkEmailError ? " ember" : ""}`}>
            <div className="between">
              <span className={`k${project.linkEmailError ? " ember" : ""}`}>The email</span>
              <span className="mono-sm">{project.linkEmailedAt ? `Sent ${dayMonth(project.linkEmailedAt)}` : project.linkEmailError ? "Not sent" : "Not sent yet"}</span>
            </div>
            <div className="stack">
              <div className="between" style={{ padding: "9px 0", borderBottom: "1px solid var(--rule-soft)" }}>
                <span>To {project.signoffPersonEmail}</span><span className="help">the sign-off address</span>
              </div>
              <div className="between" style={{ padding: "9px 0" }}>
                <span>Your project page, {c.businessName}</span>
              </div>
            </div>
            {project.linkEmailError ? (
              <form action={resendLinkAction} className="stack" style={{ gap: 8 }}>
                <input type="hidden" name="projectId" value={project.id} />
                <p className="help err">It did not go out. The project was still created, and nothing is lost by trying again.</p>
                <div><button className="a-btn" type="submit">Try sending it again</button></div>
              </form>
            ) : (
              <p className="help" style={{ lineHeight: 1.65 }}>
                Sent on its own when the project was created. Both go out: the email is the record, the WhatsApp message is the one they will actually read.
              </p>
            )}
          </div>
        </div>

        <div className="aside">
          <div className="a-card ember">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ember)" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
              <span className="k ember">There is nothing else to send</span>
            </div>
            <p className="c-sub" style={{ fontSize: 14 }}>No password, no username, no account to set up. The link is the way in and the code confirms the device.</p>
            <p className="help" style={{ lineHeight: 1.65 }}>
              If a client asks you for their password, the honest answer is that there is not one, and that is deliberate: a password we never hold is a password that cannot leak.
            </p>
          </div>
          <div className="a-card">
            <span className="k">What they will see</span>
            <p className="help" style={{ lineHeight: 1.9 }}>
              They open the link on a phone.<br />
              It offers to email them a code.<br />
              The code lands with {project.signoffPersonName}.<br />
              They type it once.<br />
              That phone stays signed in for thirty days.<br />
              Then: nothing to do yet, until the questionnaire is up.
            </p>
          </div>
          <div className="a-card">
            <span className="k">Next</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link className="a-btn" href={`/admin/projects/${project.id}/intake/upload`}>Upload the questionnaire</Link>
              <Link className="a-btn ghost" href={`/admin/projects/${project.id}`}>Go to the project</Link>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
