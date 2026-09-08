import { afterEach, describe, expect, it } from "vitest";
import { adminBase, clientBase, hostnameOf, splitHosts } from "@/lib/hosts";

/**
 * ADR 0013, two hostnames and one app. These are the rules the proxy leans on
 * to decide which zone a host may answer for, so they are worth pinning: a
 * wrong answer here either breaks a deploy or lets a client see an admin URL.
 */
const KEEP = { app: process.env.APP_URL, admin: process.env.ADMIN_URL };

afterEach(() => {
  process.env.APP_URL = KEEP.app;
  process.env.ADMIN_URL = KEEP.admin;
});

function set(app?: string, admin?: string) {
  if (app === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = app;
  if (admin === undefined) delete process.env.ADMIN_URL;
  else process.env.ADMIN_URL = admin;
}

describe("the two hostnames", () => {
  it("splits them when they are genuinely different", () => {
    set("https://portal.awtmforge.com", "https://dashboard.awtmforge.com");
    expect(splitHosts()).toEqual({ client: "portal.awtmforge.com", admin: "dashboard.awtmforge.com" });
  });

  it("runs on one host when the team host is not set", () => {
    set("https://awtmforge.com", undefined);
    expect(splitHosts()).toBeNull();
    expect(adminBase()).toBe("https://awtmforge.com");
  });

  it("runs on one host when both names are the same", () => {
    set("https://awtmforge.com", "https://awtmforge.com/");
    expect(splitHosts()).toBeNull();
  });

  it("does not split on a port or a trailing slash alone", () => {
    // Development is one host on two ports in some setups; that is not a split.
    set("http://localhost:3200", "http://localhost:3200/");
    expect(splitHosts()).toBeNull();
  });

  it("drops a trailing slash so no link is built with two", () => {
    set("https://portal.awtmforge.com/", "https://dashboard.awtmforge.com/");
    expect(clientBase()).toBe("https://portal.awtmforge.com");
    expect(adminBase()).toBe("https://dashboard.awtmforge.com");
  });

  it("treats an empty string as unset, because that is what .env.example ships", () => {
    set("", "");
    expect(clientBase()).toBe("https://portal.awtmforge.com");
    expect(splitHosts()).toBeNull();
  });

  it("ignores a hostname with the scheme forgotten, rather than building a broken link", () => {
    // The likely typo in the Hostinger panel. Without this, every team email
    // would carry "dashboard.awtmforge.com/admin/...", which is not a link.
    set("https://portal.awtmforge.com", "dashboard.awtmforge.com");
    expect(hostnameOf("dashboard.awtmforge.com")).toBeNull();
    expect(adminBase()).toBe("https://portal.awtmforge.com");
    expect(splitHosts()).toBeNull();
  });

  it("ignores a scheme that is not http or https", () => {
    set("https://portal.awtmforge.com", "ftp://dashboard.awtmforge.com");
    expect(adminBase()).toBe("https://portal.awtmforge.com");
  });
});
