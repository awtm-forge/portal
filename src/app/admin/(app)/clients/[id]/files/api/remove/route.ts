import { redirectWithFlash } from "@/lib/flash";
import { currentAdmin } from "@/modules/auth/admin";
import { removeDocument } from "@/modules/documents";

/** The team removing a file from a client's list (ADR 0025). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const form = await request.formData();
  const ok = await removeDocument(id, String(form.get("id") ?? ""));
  return redirectWithFlash(`/admin/clients/${id}`, ok ? "Removed." : "That file is not here any more.");
}
