import { ClientShell } from "@/components/portal/ClientShell";
import { FilePick } from "@/components/ui/FilePick";
import { dayMonthYear } from "@/lib/dates";
import { IntakeParty } from "@/generated/prisma/enums";
import { humanSize, listDocuments, MAX_FILES_PER_UPLOAD } from "@/modules/documents";
import { clientScope } from "../scope";

/**
 * Your files (ADR 0025). Anything the client wants us to have, any time, and
 * anything we have handed them. One list, newest first, and one form. The
 * form posts to a route rather than a server action because uploads run to
 * ten megabytes and server actions cap their body far lower.
 */
export default async function FilesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await clientScope(token);
  const docs = await listDocuments(client.id);
  const home = `/p/${token}`;

  return (
    <ClientShell businessName={client.businessName} nav={{ token, clientId: client.id, current: "files" }}>
      <div style={{ padding: "22px 0 16px" }} className="stack">
        <p className="k">Your files</p>
        <h1 className="c-title" style={{ fontSize: 26, marginTop: 8 }}>Anything you want us to have</h1>
        <p className="c-sub" style={{ marginTop: 10 }}>
          Logos, photos, brand files, a PDF. Images and PDFs, up to 10 MB each and {MAX_FILES_PER_UPLOAD} at a time. We see them the moment they are here, and anything we add for you turns up in the same list.
        </p>
      </div>

      <form method="post" action={`${home}/files/api/upload`} encType="multipart/form-data" className="stack" style={{ gap: 12, padding: "0 0 8px" }}>
        <FilePick name="file" accept="image/jpeg,image/png,image/webp,image/svg+xml,application/pdf" multiple required label="Choose files" />
        <label className="stack" style={{ gap: 6 }}>
          <span className="lbl">A line about them, if it helps. Optional.</span>
          <input className="fld" name="note" maxLength={300} placeholder="Our current logo files, and the photos from the shoot." />
        </label>
        <div><button className="btn-primary" type="submit">Send the files</button></div>
      </form>

      <div className="stack" style={{ gap: 8, paddingTop: 18 }}>
        {docs.length === 0 ? (
          <p className="help">Nothing here yet.</p>
        ) : (
          docs.map((d) => (
            <div key={d.id} className="inv-row" style={{ alignItems: "flex-start" }}>
              <a href={`${home}/files/${d.id}`} target="_blank" rel="noopener" className="stack" style={{ gap: 4, textDecoration: "none", color: "inherit", minWidth: 0, flex: 1 }}>
                <span style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                  {d.hasThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${home}/files/${d.id}?thumb`} alt="" width={44} height={44} style={{ objectFit: "cover", borderRadius: 4, flex: "none" }} />
                  ) : (
                    <span className="mono-sm" style={{ width: 44, height: 44, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--rule)", borderRadius: 4, flex: "none", fontSize: 10 }}>PDF</span>
                  )}
                  <span className="stack" style={{ gap: 3, minWidth: 0 }}>
                    <span style={{ color: "var(--ink)", overflowWrap: "anywhere" }}>{d.name}</span>
                    <span className="help">{humanSize(d.sizeBytes)} · {dayMonthYear(d.createdAt)} · {d.by === IntakeParty.CLIENT ? "from you" : "from awtm forge"}</span>
                    {d.note && <span className="help" style={{ color: "var(--ink)" }}>{d.note}</span>}
                  </span>
                </span>
              </a>
              <form method="post" action={`${home}/files/api/remove`} style={{ flex: "none" }}>
                <input type="hidden" name="id" value={d.id} />
                <button className="link-mono" type="submit" style={{ padding: 0, fontSize: "10.5px", color: "var(--faint)" }}>Remove</button>
              </form>
            </div>
          ))
        )}
      </div>
    </ClientShell>
  );
}
