"use server";

import { markAllRead } from "@/modules/notifications/client";
import { markTeamSeen } from "@/modules/notifications/team";
import { currentAdmin } from "@/modules/auth/admin";
import { clientFromSession } from "@/modules/auth/client";

/**
 * Opening the tray marks everything seen, which is what clears the count.
 *
 * Neither of these takes an id from the caller: the client is resolved from
 * the session cookie and the admin from theirs, so a bell in one browser can
 * never clear a marker in someone else's.
 */
export async function markClientNoticesSeen(): Promise<void> {
  const client = await clientFromSession();
  if (client) await markAllRead(client.id);
}

export async function markTeamNoticesSeen(): Promise<void> {
  const me = await currentAdmin();
  if (me) await markTeamSeen(me.id);
}
