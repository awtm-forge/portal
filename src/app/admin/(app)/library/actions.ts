"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/modules/auth/admin";
import { deleteImage, saveImage } from "@/modules/library";

export type LibraryState = { message?: string };

export async function uploadImageAction(_prev: LibraryState, formData: FormData): Promise<LibraryState> {
  await requireAdmin();
  const file = formData.get("file");
  const r = await saveImage({
    key: String(formData.get("key") ?? ""),
    caption: String(formData.get("caption") ?? ""),
    file: file instanceof File ? file : null,
  });
  if (!r.ok) return { message: r.message };
  redirect("/admin/library");
}

export async function deleteImageAction(formData: FormData): Promise<void> {
  await requireAdmin();
  await deleteImage(String(formData.get("key") ?? ""));
  redirect("/admin/library");
}
