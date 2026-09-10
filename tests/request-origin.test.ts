import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * QUESTIONS.md Q16. A link handed to a person on a single host points back at
 * the host the request came in on, so it works even when APP_URL names a host
 * with no DNS. This mocks next/headers to stand in for a request.
 */
const ctx = vi.hoisted(() => ({ headers: new Map<string, string>(), throws: false }));

vi.mock("next/headers", () => ({
  headers: async () => {
    if (ctx.throws) throw new Error("called outside a request");
    return { get: (k: string) => ctx.headers.get(k.toLowerCase()) ?? null };
  },
}));

// ADMIN_URL unset and APP_URL a localhost value in .env means single host,
// which is the mode this fix is about. Assert that here so the test is honest.
import { splitHosts } from "@/lib/hosts";
import { adminUrl, clientUrl } from "@/lib/request-origin";

afterEach(() => {
  ctx.headers.clear();
  ctx.throws = false;
});

describe("a link built for a person on a single host", () => {
  it("uses the forwarded host and proto the request arrived on", async () => {
    expect(splitHosts()).toBeNull();
    ctx.headers.set("x-forwarded-host", "dashboard.awtmforge.com");
    ctx.headers.set("x-forwarded-proto", "https");
    expect(await adminUrl("/admin/setup/abc")).toBe("https://dashboard.awtmforge.com/admin/setup/abc");
    expect(await clientUrl("/p/xyz")).toBe("https://dashboard.awtmforge.com/p/xyz");
  });

  it("falls back to the plain host header, and to https for a real hostname", async () => {
    ctx.headers.set("host", "dashboard.awtmforge.com");
    expect(await adminUrl("/admin/setup/abc")).toBe("https://dashboard.awtmforge.com/admin/setup/abc");
  });

  it("keeps http for localhost, so a dev link is clickable", async () => {
    ctx.headers.set("host", "localhost:3200");
    expect(await adminUrl("/admin/setup/abc")).toBe("http://localhost:3200/admin/setup/abc");
  });

  it("does not take a host it cannot parse, falling back to the configured base", async () => {
    ctx.headers.set("host", "");
    const link = await adminUrl("/admin/setup/abc");
    expect(link.endsWith("/admin/setup/abc")).toBe(true);
    expect(link.startsWith("http")).toBe(true);
  });

  it("outside a request, uses the configured base", async () => {
    ctx.throws = true;
    const link = await clientUrl("/p/xyz");
    expect(link.endsWith("/p/xyz")).toBe(true);
    expect(link.startsWith("http")).toBe(true);
  });
});
