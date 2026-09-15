import { IntakeParty } from "@/generated/prisma/enums";
import { redirectWithFlash } from "@/lib/flash";
import { currentAdmin } from "@/modules/auth/admin";
import { byId } from "@/modules/clients";
import { storeDocuments } from "@/modules/documents";
import "@/modules/notifications/register";

/** The team adding a file for a client (ADR 0025): the client is told, and it sits in their list. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const client = await byId(id);
  if (!client) return new Response("Not found", { status: 404 });
  const form = await request.formData();
  const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  const back = `/admin/clients/${id}`;
  if (files.length === 0) return redirectWithFlash(back, "Nothing added: choose a file first.");
  const result = await storeDocuments({
    clientId: client.id,
    businessName: client.businessName,
    files,
    note: String(form.get("note") ?? ""),
    by: IntakeParty.TEAM,
    actor: admin.name,
  });
  const n = result.stored.length;
  const refused = result.refused.length ? ` ${result.refused.map((r) => `${r.name}: ${r.message}`).join(" ")}` : "";
  return redirectWithFlash(back, n > 0 ? `${n === 1 ? "File" : `${n} files`} added. ${client.contactName.split(" ")[0]} has been told.${refused}` : `Not added.${refused}`);
}
