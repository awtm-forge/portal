import { currentAdmin } from "@/modules/auth/admin";
import { serveProjectFile } from "@/modules/intake/handlers";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  if (!(await currentAdmin())) return new Response("Not found", { status: 404 });
  const { id, fileId } = await params;
  return serveProjectFile(id, fileId, new URL(request.url).searchParams.has("thumb"));
}
