import { IntakeParty } from "@/generated/prisma/enums";
import { redirectWithFlash } from "@/lib/flash";
import { currentClientSession, resolveClient } from "@/modules/auth/client";
import { storeDocuments } from "@/modules/documents";
import "@/modules/notifications/register";

/** A client's upload (ADR 0025): the same checks as a questionnaire file, then back to the list with a line. */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await resolveClient(token);
  if (!client) return new Response("Not found", { status: 404 });
  if (!(await currentClientSession(client.id))) return new Response("Not found", { status: 404 });
  const form = await request.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  const back = `/p/${token}/files`;
  if (files.length === 0) return redirectWithFlash(back, "Nothing was sent: choose a file first.");
  const result = await storeDocuments({
    clientId: client.id,
    businessName: client.businessName,
    files,
    note: String(form.get("note") ?? ""),
    by: IntakeParty.CLIENT,
    actor: "client",
  });
  const n = result.stored.length;
  const refused = result.refused.length ? ` ${result.refused.map((r) => `${r.name}: ${r.message}`).join(" ")}` : "";
  return redirectWithFlash(back, n > 0 ? `${n === 1 ? "File" : `${n} files`} sent. We have ${n === 1 ? "it" : "them"}.${refused}` : `Not sent.${refused}`);
}
