import { currentClientSession, resolveClient } from "@/modules/auth/client";
import { handleIntakeAction } from "@/modules/intake/handlers";

export async function POST(request: Request, { params }: { params: Promise<{ token: string; action: string }> }) {
  const { token, action } = await params;
  const client = await resolveClient(token);
  if (!client) return new Response("Not found", { status: 404 });
  if (!(await currentClientSession(client.id))) return new Response("Sign in again", { status: 401 });
  return handleIntakeAction(request, action, { clientId: client.id, enteredBy: "client", canSubmit: true });
}
