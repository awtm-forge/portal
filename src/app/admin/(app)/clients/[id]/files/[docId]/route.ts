import { currentAdmin } from "@/modules/auth/admin";
import { serveDocument } from "@/modules/documents";

/** A client's file, for the team, or its thumbnail with ?thumb (ADR 0025). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return new Response("Not found", { status: 404 });
  const { id, docId } = await params;
  return serveDocument(id, docId, new URL(request.url).searchParams.has("thumb"));
}
