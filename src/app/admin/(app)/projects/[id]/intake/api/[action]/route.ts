import { currentAdmin } from "@/modules/auth/admin";
import { db } from "@/lib/db";
import { handleIntakeAction } from "@/lib/intake/handlers";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!(await currentAdmin())) return new Response("Sign in", { status: 401 });
  const { id, action } = await params;
  const project = await db.project.findUnique({ where: { id }, select: { id: true } });
  if (!project) return new Response("Not found", { status: 404 });
  return handleIntakeAction(request, action, { projectId: project.id, enteredBy: "team", canSubmit: false });
}
