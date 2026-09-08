/**
 * One id per request, so five lines about the same failure can be found
 * together (CLAUDE.md 11).
 *
 * `src/proxy.ts` puts it on the request before anything renders and echoes it
 * on the response, so an id in a browser's network tab or a curl -I matches
 * the lines in Hostinger's log viewer. That is the whole point: Rahul can send
 * "it broke, here is the id" and it is one search.
 *
 * Reading it is best effort. `headers()` throws outside a request, which is
 * every script, every test and the seed, and none of those want to fail over a
 * log field.
 */
import { headers } from "next/headers";

export const REQUEST_ID_HEADER = "x-request-id";

export function newRequestId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export async function currentRequestId(): Promise<string | null> {
  try {
    return (await headers()).get(REQUEST_ID_HEADER);
  } catch {
    return null;
  }
}
