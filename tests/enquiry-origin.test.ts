import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The public site posts its enquiry form from its own origin (site repo,
 * CLAUDE.md section 4). SITE_ORIGIN names that one origin. This mocks the
 * database, the rate limit and the events so only the origin rule runs.
 */
const created = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock("@/lib/db", () => ({ db: { enquiry: { create: async ({ data }: { data: unknown }) => void created.rows.push(data) } } }));
vi.mock("@/lib/rate-limit", () => ({ allow: async () => true, clientIp: () => "127.0.0.1" }));
vi.mock("@/modules/events", () => ({ emit: async () => undefined }));
vi.mock("@/modules/notifications/register", () => ({}));

import { OPTIONS, POST } from "@/app/api/enquiry/route";

const body = JSON.stringify({ name: "A", problem: "Orders slowed", contact: "a@example.com" });
function post(origin?: string) {
  const headers: Record<string, string> = { host: "dashboard.awtmforge.com", "content-type": "application/json" };
  if (origin) headers.origin = origin;
  return POST(new Request("https://dashboard.awtmforge.com/api/enquiry", { method: "POST", headers, body }));
}

beforeEach(() => {
  process.env.SITE_ORIGIN = "https://awtmforge.com";
  created.rows.length = 0;
});
afterEach(() => {
  delete process.env.SITE_ORIGIN;
});

describe("the enquiry endpoint and the site's origin", () => {
  it("allows the site's origin and answers with CORS headers", async () => {
    const res = await post("https://awtmforge.com");
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://awtmforge.com");
    expect(res.headers.get("vary")).toBe("Origin");
    expect(created.rows).toHaveLength(1);
  });

  it("refuses any other cross-origin request, and stores nothing", async () => {
    const res = await post("https://evil.example");
    expect(res.status).toBe(403);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(created.rows).toHaveLength(0);
  });

  it("refuses the site too while SITE_ORIGIN is unset, the designed failure", async () => {
    delete process.env.SITE_ORIGIN;
    const res = await post("https://awtmforge.com");
    expect(res.status).toBe(403);
  });

  it("still accepts same-origin posts without CORS headers", async () => {
    const res = await post("https://dashboard.awtmforge.com");
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers the preflight for the site and nobody else", async () => {
    const ok = await OPTIONS(new Request("https://dashboard.awtmforge.com/api/enquiry", { method: "OPTIONS", headers: { origin: "https://awtmforge.com" } }));
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://awtmforge.com");
    expect(ok.headers.get("access-control-allow-methods")).toBe("POST");
    expect(ok.headers.get("access-control-allow-headers")).toBe("Content-Type");
    expect(Number(ok.headers.get("access-control-max-age"))).toBeGreaterThan(0);
    const no = await OPTIONS(new Request("https://dashboard.awtmforge.com/api/enquiry", { method: "OPTIONS", headers: { origin: "https://evil.example" } }));
    expect(no.status).toBe(403);
  });
});
