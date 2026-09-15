import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mailMode, mailVars } from "@/lib/mail";
import { adminBase, clientBase, hostnameOf } from "@/lib/hosts";
import { activatedAdminCount, listAdmins } from "@/modules/auth/admin";
import { linkCopyCounts } from "@/modules/clients";
import { requestLogger, safeError } from "@/lib/logger";
import { company } from "@/modules/settings";

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
        // How many clients still have no readable copy of their link, so the
        // "we do not hold this link" card can be counted from outside and
        // watched fall to zero (15 Sep). Counts only.
        clients: await linkCopyCounts(),
        // Which client-facing settings are filled in, by name, never their
        // values. An empty booking link silently turns Book a meeting into a
        // mailto, and an empty phone takes WhatsApp off every client page;
        // both looked like bugs from the outside on 12 September.
        settings: await settingsSet(),
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    await requestLogger.error("healthz: the database did not answer", { error: safeError(error) });
    return NextResponse.json({ status: "degraded" }, { status: 503, headers: NO_STORE });
  }
}

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

/**
 * Names, never values, in the shape mailVars uses: which of the settings a
 * client can feel are filled in. The booking link and the phone are things a
 * client clicks, so neither is a secret, but a health endpoint answers
 * without signing in and has no business handing out either.
 */
async function settingsSet(): Promise<{ set: string[]; empty: string[] }> {
  const c = await company();
  const fields: Record<string, string | null | undefined> = {
    BOOKING_URL: c.bookingUrl,
    PHONE: c.phone,
    BANK_ACCOUNT: c.bankAccountNumber,
    UPI_ID: c.upiId,
    GSTIN: c.gstin,
  };
  const set: string[] = [];
  const empty: string[] = [];
  for (const [name, value] of Object.entries(fields)) (value?.trim() ? set : empty).push(name);
  return { set, empty };
}
