import { currentAdmin } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { answersDocument } from "@/lib/intake/answers";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentAdmin())) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const project = await db.project.findUnique({ where: { id }, include: { intake: true } });
  if (!project?.intake) return new Response("Not found", { status: 404 });
  const body = JSON.stringify(answersDocument(project, project.intake), null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="answers-${project.slug}.json"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
