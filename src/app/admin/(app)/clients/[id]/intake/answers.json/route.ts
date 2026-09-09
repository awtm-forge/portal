import { currentAdmin } from "@/modules/auth/admin";
import { withIntake } from "@/modules/clients";
import { answersDocument } from "@/modules/intake/answers";
import { versionAt, versionsFor } from "@/modules/intake/versions";

/** The current answers, or `?version=n` for the answers as they were sent then (ADR 0016). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentAdmin())) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const client = await withIntake(id);
  if (!client?.intake) return new Response("Not found", { status: 404 });
  const wanted = Number(new URL(request.url).searchParams.get("version") ?? "");
  const versions = await versionsFor(client.id);
  const latest = versions[versions.length - 1]?.version ?? null;
  let document = answersDocument(client, client.intake, latest);
  let suffix = "";
  if (Number.isInteger(wanted) && wanted >= 1) {
    const snapshot = await versionAt(client.id, wanted);
    if (!snapshot) return new Response("Not found", { status: 404 });
    document = answersDocument(client, { ...client.intake, answers: snapshot.answers, accessGranted: snapshot.accessGranted, submittedAt: snapshot.sentAt }, wanted);
    suffix = `-v${wanted}`;
  }
  const body = JSON.stringify(document, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="answers-${client.id}${suffix}.json"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
