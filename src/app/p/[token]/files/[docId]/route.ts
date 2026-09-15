import { currentClientSession, resolveClient } from "@/modules/auth/client";
import { serveDocument } from "@/modules/documents";

/** A client's own file, or its thumbnail with ?thumb (ADR 0025). */
export async function GET(request: Request, { params }: { params: Promise<{ token: string; docId: string }> }) {
  const { token, docId } = await params;
  const client = await resolveClient(token);
  if (!client) return new Response("Not found", { status: 404 });
  if (!(await currentClientSession(client.id))) return new Response("Not found", { status: 404 });
  return serveDocument(client.id, docId, new URL(request.url).searchParams.has("thumb"));
}
