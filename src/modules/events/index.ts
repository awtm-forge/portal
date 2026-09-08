import { db } from "@/lib/db";
import { requestLogger, safeError } from "@/lib/logger";
import type { Activity } from "./types";

export type { Activity, ActivityPayload, EventType } from "./types";

type Subscriber = (activity: Activity) => Promise<void> | void;

const subscribers: Subscriber[] = [];

/** Called once at module load by modules/notifications. ADR 0006. */
export function subscribe(fn: Subscriber): void {
  subscribers.push(fn);
}

/**
 * Write the event, then tell the subscribers. In process, not a queue: one
 * node and two founders (ARCHITECTURE.md). A subscriber that throws is logged
 * and does not undo the change that raised the event, because an email that
 * fails must not roll back a sign-off.
 */
export async function emit(activity: Activity): Promise<void> {
  try {
    await db.activityEvent.create({
      data: {
        type: activity.type,
        projectId: activity.projectId,
        actor: activity.actor.slice(0, 120),
        payload: activity.payload,
      },
    });
  } catch (error) {
    await requestLogger.error("activity_event write failed", { type: activity.type, error: safeError(error) });
  }

  await Promise.all(
    subscribers.map(async (fn) => {
      try {
        await fn(activity);
      } catch (error) {
        await requestLogger.error("subscriber failed", { type: activity.type, error: safeError(error) });
      }
    }),
  );
}
