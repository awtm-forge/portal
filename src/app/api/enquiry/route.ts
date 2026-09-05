import { NextResponse } from "next/server";

// Step 1 of the build: the marketing site is live before the database exists.
// Until the enquiry table lands, this route says so honestly instead of
// pretending to send. It never logs the body.

export async function POST() {
  return NextResponse.json(
    { error: "Could not send just now. Email hello@awtmforge.com and we will reply within one working day." },
    { status: 503 },
  );
}
