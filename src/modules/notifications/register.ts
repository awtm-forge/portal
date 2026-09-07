/**
 * Imported by the routes that emit events, so the subscribers exist before the
 * first emit in a fresh server process. ADR 0006.
 */
import "@/modules/notifications";
