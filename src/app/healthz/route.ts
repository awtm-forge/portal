import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mailMode, mailVars } from "@/lib/mail";
import { adminBase, clientBase, hostnameOf } from "@/lib/hosts";
import { activatedAdminCount, listAdmins } from "@/modules/auth/admin";
import { requestLogger, safeError } from "@/lib/logger";

/**
 * What Hostinger's monitor pings, and the first thing to curl when something
 * looks wrong. It answers 200 only if the database answers, because a node
 * that is up with no database serves nothing anyone wants.
 *
 * It says whether it is well, which build it is, whether anyone can sign in
 * yet, and which mail variables it can see, by name. No values, no error
 * text: a health endpoint is reachable without signing in, and the failure
 * detail belongs in the log.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    // Which build is running, and whether anyone can sign in yet. Neither is
    // a secret: the commit is a short hash of a private repo, and "claimed"
    // is what the first-run page already reveals by existing or not. Both
    // would have saved an afternoon of guessing on 9 September.
    const activated = await activatedAdminCount();
    const claimed = activated > 0;
    // Numbers only, never an address: how many admin rows exist and how many
    // can sign in. Two rows means both seats are taken and a third invite is
    // refused (10 Sep 2026: this is how we tell a seat problem from a bad
    // input without reaching into the database).
    const adminRows = (await listAdmins()).length;
    return NextResponse.json(
      {
        status: "ok",
        commit: process.env.BUILD_COMMIT ?? "unknown",
        claimed,
        mail: mailMode(),
        mailVars: mailVars(),
        links: { client: hostnameOf(clientBase()), admin: hostnameOf(adminBase()) },
        admins: { rows: adminRows, activated },
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    await requestLogger.error("healthz: the database did not answer", { error: safeError(error) });
    return NextResponse.json({ status: "degraded" }, { status: 503, headers: NO_STORE });
  }
}

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
