import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { allow, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  business: z.string().trim().max(200).default(""),
  problem: z.string().trim().min(1).max(4000),
  budget: z.string().trim().max(80).default("Not sure yet"),
  adSpend: z.string().trim().max(80).default("Prefer not to say"),
  contact: z.string().trim().min(3).max(200),
});

const fallback = "Could not send just now. Email hello@awtmforge.com and we will reply within one working day.";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: fallback }, { status: 403 });
  }
  let allowed: boolean;
  try {
    allowed = await allow(`enquiry:ip:${clientIp(request.headers)}`, 5, 60 * 60);
  } catch {
    return NextResponse.json({ error: fallback }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "Too many messages from this connection. Try again in an hour." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "That did not come through. Try again." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Name, what is not working, and how to reach you are needed." }, { status: 400 });
  }
  try {
    await db.enquiry.create({ data: parsed.data });
  } catch {
    return NextResponse.json({ error: fallback }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
