import { currentAdmin } from "@/modules/auth/admin";
import { byId } from "@/modules/clients";
import { handleIntakeAction } from "@/modules/intake/handlers";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!(await currentAdmin())) return new Response("Sign in", { status: 401 });
  const { id, action } = await params;
  const client = await byId(id);
  if (!client) return new Response("Not found", { status: 404 });
  return handleIntakeAction(request, action, { clientId: client.id, enteredBy: "team", canSubmit: false });
}
