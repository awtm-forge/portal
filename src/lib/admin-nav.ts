import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flash } from "@/lib/flash";

/**
 * Redirect after a mutation, refreshing the target page first. A server action
 * that mutates and then redirects to the same path re-serves the cached render
 * without this, so the change lands in the database but does not show, which
 * reads as a dead button (the admin Remove on 10 Sep and Cancel on 11 Sep both
 * hit it). Server actions and route handlers only.
 */
export function refreshTo(path: string): never {
  revalidatePath(path);
  redirect(path);
}

/** The same, with a one-line confirmation the next page shows as a toast. */
export async function refreshWith(path: string, message: string): Promise<never> {
  await flash(message);
  refreshTo(path);
}
