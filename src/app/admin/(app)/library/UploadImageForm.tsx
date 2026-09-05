"use client";

import { useActionState } from "react";
import { uploadImageAction, type LibraryState } from "./actions";

export function UploadImageForm() {
  const [state, action, pending] = useActionState<LibraryState, FormData>(uploadImageAction, {});
  return (
    <form action={action} className="a-card" encType="multipart/form-data">
      <span className="k">Add or replace an image</span>
      <label className="stack" style={{ gap: 6 }}><span className="lbl">Key, lowercase, letters digits and hyphens</span><input className="a-fld mono" name="key" placeholder="layout-grid" required /></label>
      <label className="stack" style={{ gap: 6 }}><span className="lbl">Caption, shown under the picture</span><input className="a-fld" name="caption" placeholder="Grid layout" required /></label>
      <label className="stack" style={{ gap: 6 }}><span className="lbl">File</span><input className="a-fld" type="file" name="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" required /></label>
      {state.message && <p className="help err">{state.message}</p>}
      <div><button className="a-btn" type="submit" disabled={pending}>{pending ? "Uploading" : "Upload"}</button></div>
      <p className="help" style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: 12, lineHeight: 1.65 }}>Same rules as client uploads. Checked by magic bytes, re-encoded, EXIF stripped, SVG sanitised. Uploading to an existing key replaces its picture. A key in use by any uploaded questionnaire cannot be deleted.</p>
    </form>
  );
}
