import { NextResponse } from "next/server";
import { getClient, opsKeyOk } from "@/modules/ops/read";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!opsKeyOk(req.headers.get("x-ops-key"))) return new Response("Not found", { status: 404 });
  const { id } = await ctx.params;
  const client = await getClient(id);
  if (!client) return new Response("Not found", { status: 404 });
  return NextResponse.json(client, { headers: { "Cache-Control": "no-store" } });
}
