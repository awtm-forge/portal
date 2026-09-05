import { currentClientSession, projectByToken } from "@/lib/client-auth";
import { handleIntakeAction } from "@/lib/intake/handlers";

export async function POST(request: Request, { params }: { params: Promise<{ token: string; action: string }> }) {
  const { token, action } = await params;
  const project = await projectByToken(token);
  if (!project) return new Response("Not found", { status: 404 });
  if (!(await currentClientSession(project.id))) return new Response("Sign in again", { status: 401 });
  return handleIntakeAction(request, action, { projectId: project.id, enteredBy: "client", canSubmit: true });
}
