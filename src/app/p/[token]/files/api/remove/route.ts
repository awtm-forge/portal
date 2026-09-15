import { redirectWithFlash } from "@/lib/flash";
import { currentClientSession, resolveClient } from "@/modules/auth/client";
import { removeDocument } from "@/modules/documents";

/** A client taking one of their files back (ADR 0025). Their own only. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await resolveClient(token);
  if (!client) return new Response("Not found", { status: 404 });
  if (!(await currentClientSession(client.id))) return new Response("Not found", { status: 404 });
  const form = await request.formData();
  const ok = await removeDocument(client.id, String(form.get("id") ?? ""));
  return redirectWithFlash(`/p/${token}/files`, ok ? "Removed." : "That file is not here any more.");
}
