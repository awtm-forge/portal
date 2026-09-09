import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mailVars } from "@/lib/mail";

/**
 * /healthz names the mail variables it can see, so a missing or misspelt one
 * in the hosting panel is a glance rather than a guess. Names only: CLAUDE.md
 * section 2 item 4 says no credential of ours reaches a log or a message, and
 * a health endpoint needs no sign-in.
 */
const NAMES = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "TEAM_NOTIFY_EMAIL",
  "SMTP_HOST ",
] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(NAMES.map((name) => [name, process.env[name]]));
  for (const name of NAMES) delete process.env[name];
});

afterEach(() => {
  for (const name of NAMES) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
});

describe("what /healthz says about the mail variables", () => {
  it("sorts each name into set, empty or missing", () => {
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.SMTP_PASS = "";
    const seen = mailVars();
    expect(seen.set).toEqual(["SMTP_HOST"]);
    expect(seen.empty).toEqual(["SMTP_PASS"]);
    expect(seen.missing).toEqual(["SMTP_PORT", "SMTP_USER", "SMTP_FROM", "TEAM_NOTIFY_EMAIL"]);
    expect(seen.strays).toEqual([]);
  });

  it("shows a key with a stray space in quotes, so the space is visible", () => {
    process.env["SMTP_HOST "] = "smtp.example.test";
    const seen = mailVars();
    expect(seen.strays).toEqual(['"SMTP_HOST "']);
    expect(seen.missing).toContain("SMTP_HOST");
  });

  it("never carries a value", () => {
    process.env.SMTP_PASS = "hunter2-no-really";
    process.env.SMTP_HOST = "smtp.example.test";
    const line = JSON.stringify(mailVars());
    expect(line).not.toContain("hunter2");
    expect(line).not.toContain("example.test");
  });
});
