import { currentAdmin } from "@/modules/auth/admin";
import { withIntake } from "@/modules/clients";
import { answersDocument } from "@/modules/intake/answers";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentAdmin())) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const client = await withIntake(id);
  if (!client?.intake) return new Response("Not found", { status: 404 });
  const body = JSON.stringify(answersDocument(client, client.intake), null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="answers-${client.id}.json"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
