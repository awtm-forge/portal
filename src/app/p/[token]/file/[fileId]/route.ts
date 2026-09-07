import { currentClientSession, projectByToken } from "@/modules/auth/client";
import { serveProjectFile } from "@/lib/intake/handlers";

export async function GET(request: Request, { params }: { params: Promise<{ token: string; fileId: string }> }) {
  const { token, fileId } = await params;
  const project = await projectByToken(token);
  if (!project) return new Response("Not found", { status: 404 });
  if (!(await currentClientSession(project.id))) return new Response("Not found", { status: 404 });
  return serveProjectFile(project.id, fileId, new URL(request.url).searchParams.has("thumb"));
}
