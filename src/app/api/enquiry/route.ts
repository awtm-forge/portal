import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { allow, clientIp } from "@/lib/rate-limit";
import { emit } from "@/modules/events";
import "@/modules/notifications/register";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  business: z.string().trim().max(200).default(""),
  problem: z.string().trim().min(1).max(4000),
  budget: z.string().trim().max(80).default("Not sure yet"),
  adSpend: z.string().trim().max(80).default("Prefer not to say"),
  contact: z.string().trim().min(3).max(200),
});

const fallback = "Could not send just now. Email hello@awtmforge.com and we will reply within one working day.";

/* The public site at awtmforge.com is its own application on its own host
   (ADR 0012), so its form arrives cross-origin. SITE_ORIGIN names that one
   origin; a request from it is allowed and answered with CORS headers. Every
   other cross-origin request stays refused, and same-origin keeps working.
   While SITE_ORIGIN is unset the site's form gets 403 and shows its fallback
   line, which is the designed failure (site repo, DEPLOY.md). */
function siteOrigin(): string | null {
  const v = process.env.SITE_ORIGIN?.trim().replace(/\/$/, "");
  return v ? v : null;
}
function corsHeaders(origin: string): Record<string, string> {
  return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}
/* Same-origin, no Origin header, or the one allowed site. */
function originAllowed(request: Request): { ok: true; cors: Record<string, string> } | { ok: false } {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin) return { ok: true, cors: {} };
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return { ok: false };
  }
  if (host && originHost === host) return { ok: true, cors: {} };
  const site = siteOrigin();
  if (site && origin === site) return { ok: true, cors: corsHeaders(site) };
  return { ok: false };
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  const site = siteOrigin();
  if (!origin || !site || origin !== site) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(site),
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function POST(request: Request) {
  const allowedOrigin = originAllowed(request);
  if (!allowedOrigin.ok) {
    return NextResponse.json({ error: fallback }, { status: 403 });
  }
  const cors = allowedOrigin.cors;
  let allowed: boolean;
  try {
    allowed = await allow(`enquiry:ip:${clientIp(request.headers)}`, 5, 60 * 60);
  } catch {
    return NextResponse.json({ error: fallback }, { status: 503, headers: cors });
  }
  if (!allowed) {
    return NextResponse.json({ error: "Too many messages from this connection. Try again in an hour." }, { status: 429, headers: cors });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "That did not come through. Try again." }, { status: 400, headers: cors });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Name, what is not working, and how to reach you are needed." }, { status: 400, headers: cors });
  }
  try {
    await db.enquiry.create({ data: parsed.data });
  } catch {
    return NextResponse.json({ error: fallback }, { status: 503, headers: cors });
  }
  // CLAUDE.md section 5: stored, and emailed to the team. The static page
  // itself still fetches nothing.
  await emit({ type: "enquiry.received", projectId: null, actor: "visitor", payload: { ...parsed.data } });
  return NextResponse.json({ ok: true }, { headers: cors });
}
