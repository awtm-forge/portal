import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

/**
 * ADR 0013. Each hostname answers for its own zone only. This is the rule that
 * keeps a client from ever seeing an admin URL, so it is checked here rather
 * than end to end: the test server runs on one host, and turning the split on
 * for the whole suite would make every admin test a 404.
 */
const CLIENT = "portal.awtmforge.com";
const ADMIN = "dashboard.awtmforge.com";
const KEEP = { app: process.env.APP_URL, admin: process.env.ADMIN_URL };

afterEach(() => {
  process.env.APP_URL = KEEP.app;
  process.env.ADMIN_URL = KEEP.admin;
});

function split() {
  process.env.APP_URL = `https://${CLIENT}`;
  process.env.ADMIN_URL = `https://${ADMIN}`;
}

function ask(host: string, path: string) {
  return proxy(new NextRequest(new URL(`https://${host}${path}`), { headers: { host } }));
}

describe("which host answers for which zone", () => {
  it("refuses the admin on the client host", () => {
    split();
    expect(ask(CLIENT, "/admin").status).toBe(404);
    expect(ask(CLIENT, "/admin/projects/abc").status).toBe(404);
  });

  it("refuses a client page on the team host", () => {
    split();
    expect(ask(ADMIN, "/p/sometoken").status).toBe(404);
  });

  it("serves each host its own zone", () => {
    split();
    expect(ask(CLIENT, "/p/sometoken").status).toBe(200);
    expect(ask(ADMIN, "/admin/projects/abc").status).toBe(200);
  });

  it("serves the printable routes on both, because both need them", () => {
    split();
    for (const host of [CLIENT, ADMIN]) {
      expect(ask(host, "/invoice/abc/print").status).toBe(200);
      expect(ask(host, "/agreement/abc/print").status).toBe(200);
    }
  });

  it("sends the bare team host to the projects list", () => {
    split();
    const response = ask(ADMIN, "/");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://${ADMIN}/admin`);
  });

  it("leaves the bare client host on the way-in page", () => {
    split();
    expect(ask(CLIENT, "/").status).toBe(200);
  });

  it("refuses nothing when the app runs on one host", () => {
    process.env.APP_URL = "https://awtmforge.com";
    delete process.env.ADMIN_URL;
    expect(ask("awtmforge.com", "/admin").status).toBe(200);
    expect(ask("awtmforge.com", "/p/sometoken").status).toBe(200);
    expect(ask("awtmforge.com", "/").status).toBe(200);
  });

  it("still sends noindex and no-store on what it does serve", () => {
    split();
    const response = ask(CLIENT, "/p/sometoken");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("says nothing about the other host when it refuses", () => {
    split();
    const response = ask(CLIENT, "/admin");
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });
});
