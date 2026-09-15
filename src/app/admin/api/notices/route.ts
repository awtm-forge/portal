import { NextResponse } from "next/server";
import { teamBell } from "@/components/admin/team-bell";
import { currentAdmin } from "@/modules/auth/admin";

/** The team's bell, refreshed in place (15 Sep). The same data the shell renders. */
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await currentAdmin();
  if (!me) return new Response("Not found", { status: 404 });
  return NextResponse.json(await teamBell(me), { headers: { "Cache-Control": "no-store" } });
}
