import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/modules/auth/admin";
import { libraryUsage, listImages } from "@/modules/library";
import { deleteImageAction } from "./actions";
import { UploadImageForm } from "./UploadImageForm";

export default async function LibraryPage() {
  const admin = await requireAdmin();
  const [images, usage] = await Promise.all([listImages(), libraryUsage()]);
  return (
    <AdminShell active="library" adminName={admin.name}>
      <div className="stack" style={{ gap: 6 }}>
        <h1 className="a-title">Image library</h1>
        <p className="a-sub">Pictures an image_choice question can name by key. {images.length} in the library. Upload before the questionnaire that needs them.</p>
      </div>
      <div className="a-cols">
        <div className="main">
          <div className="a-card">
            <span className="k">Library</span>
            {images.length === 0 && <p className="c-sub" style={{ fontSize: 14 }}>Empty. The seed adds the six logo directions.</p>}
            <div className="grid3">
              {images.map((img) => {
                const used = usage.get(img.key) ?? 0;
                return (
                  <div key={img.key} style={{ border: "1px solid var(--rule)", borderRadius: 2, background: "var(--ground)", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/admin/lib/${encodeURIComponent(img.key)}`} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block", borderRadius: 2 }} />
                    <span className="mono-sm" style={{ color: "var(--ink)", fontSize: 11.5 }}>{img.key}</span>
                    <span className="help">{img.caption} · {used === 0 ? "not used yet" : `used by ${used} ${used === 1 ? "questionnaire" : "questionnaires"}`}</span>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {used === 0 ? (
                        <form action={deleteImageAction}><input type="hidden" name="key" value={img.key} /><button className="link-mono" type="submit" style={{ padding: 0, fontSize: "10.5px" }}>Delete</button></form>
                      ) : (
                        <span className="mono-sm" style={{ fontSize: "10.5px", color: "var(--faint)" }}>Delete, in use</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="aside">
          <UploadImageForm />
        </div>
      </div>
    </AdminShell>
  );
}
