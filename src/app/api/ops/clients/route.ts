import { NextResponse } from "next/server";
import { listClients, opsKeyOk, summary } from "@/modules/ops/read";

/**
 * The ops console's read of the portal. A shared key in `x-ops-key`, set as
 * OPS_API_KEY here and PORTAL_API_KEY there. With no key configured the route
 * does not exist, so a portal that never heard of ops answers 404, as it
 * would for any unknown path.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!opsKeyOk(req.headers.get("x-ops-key"))) return new Response("Not found", { status: 404 });
  const [clients, totals] = await Promise.all([listClients(), summary()]);
  return NextResponse.json({ clients, totals, generatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
