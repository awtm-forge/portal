import { currentClientSession, projectByToken } from "@/modules/auth/client";
import { serveLibraryImage } from "@/modules/intake/handlers";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string; key: string }> }) {
  const { token, key } = await params;
  const project = await projectByToken(token);
  if (!project) return new Response("Not found", { status: 404 });
  if (!(await currentClientSession(project.id))) return new Response("Not found", { status: 404 });
  return serveLibraryImage(key);
}
