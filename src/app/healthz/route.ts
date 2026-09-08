import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requestLogger } from "@/lib/logger";

/**
 * What Hostinger's monitor pings, and the first thing to curl when something
 * looks wrong. It answers 200 only if the database answers, because a node
 * that is up with no database serves nothing anyone wants.
 *
 * It says whether it is well and nothing else. No version, no environment, no
 * error text: a health endpoint is reachable without signing in, and the
 * failure detail belongs in the log where only we can read it.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { headers: NO_STORE });
  } catch (error) {
    await requestLogger.error("healthz: the database did not answer", { error: String(error) });
    return NextResponse.json({ status: "degraded" }, { status: 503, headers: NO_STORE });
  }
}

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
