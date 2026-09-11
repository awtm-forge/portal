"use server";

import { refreshWith } from "@/lib/admin-nav";
import { requireAdmin } from "@/modules/auth/admin";
import { deleteImage, saveImage } from "@/modules/library";

export type LibraryState = { message?: string };

export async function uploadImageAction(_prev: LibraryState, formData: FormData): Promise<LibraryState> {
  await requireAdmin();
  const file = formData.get("file");
  const key = String(formData.get("key") ?? "");
  const r = await saveImage({
    key,
    caption: String(formData.get("caption") ?? ""),
    file: file instanceof File ? file : null,
  });
  if (!r.ok) return { message: r.message };
  return refreshWith("/admin/library", `Uploaded ${key}.`);
}

export async function deleteImageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const key = String(formData.get("key") ?? "");
  await deleteImage(key);
  await refreshWith("/admin/library", `Deleted ${key}.`);
}
