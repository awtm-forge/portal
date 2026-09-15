import { NextResponse } from "next/server";
import { clientBell } from "@/components/portal/client-bell";
import { currentClientSession, resolveClient } from "@/modules/auth/client";

/** A client's bell, refreshed in place (15 Sep). The same data the shell renders. */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const client = await resolveClient(token);
  if (!client) return new Response("Not found", { status: 404 });
  if (!(await currentClientSession(client.id))) return new Response("Not found", { status: 404 });
  return NextResponse.json(await clientBell(client.id, `/p/${token}`), { headers: { "Cache-Control": "no-store" } });
}
