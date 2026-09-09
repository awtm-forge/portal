import { clientByToken, currentClientSession } from "@/modules/auth/client";
import { serveClientFile } from "@/modules/intake/handlers";

export async function GET(request: Request, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await params;
  const client = await clientByToken(token);
  if (!client) return new Response("Not found", { status: 404 });
  if (!(await currentClientSession(client.id))) return new Response("Not found", { status: 404 });
  return serveClientFile(client.id, fileId, new URL(request.url).searchParams.has("thumb"));
}
