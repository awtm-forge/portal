import { AdminShell } from "@/components/admin/AdminShell";
import { Confirm } from "@/components/ui/Confirm";
import { Empty } from "@/components/ui/Empty";
import { requireAdmin } from "@/modules/auth/admin";
import { libraryUsage, listImages } from "@/modules/library";
import { deleteImageAction } from "./actions";
import { UploadImageForm } from "./UploadImageForm";

/** The pictures an image_choice question can name. Two across on a phone, three on a laptop; delete asks first (F-32, F-34). */
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
            {images.length === 0 && <Empty title="Empty" line="The seed adds the six logo directions. Upload one on the right." />}
            <div className="lib-grid">
              {images.map((img) => {
                const used = usage.get(img.key) ?? 0;
                return (
                  <div key={img.key} className="lib-cell">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/admin/lib/${encodeURIComponent(img.key)}`} alt="" />
                    <span className="mono-sm" style={{ color: "var(--ink)" }}>{img.key}</span>
                    <span className="help">{img.caption}</span>
                    <div className="between" style={{ marginTop: "auto", paddingTop: 4 }}>
                      <span className="tag" style={{ color: used === 0 ? "var(--faint)" : "var(--muted)" }}>{used === 0 ? "not used yet" : `in ${used} ${used === 1 ? "questionnaire" : "questionnaires"}`}</span>
                      {used === 0 && (
                        <Confirm
                          trigger="Delete"
                          triggerClass="link-mono"
                          title={`Delete ${img.key}?`}
                          line="The picture is removed from the library for good. Nothing else refers to it."
                          confirmLabel="Delete it"
                          action={deleteImageAction}
                        >
                          <input type="hidden" name="key" value={img.key} />
                        </Confirm>
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
