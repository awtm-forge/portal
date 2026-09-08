import { describe, expect, it } from "vitest";
import { safeError } from "@/lib/logger";

/**
 * Acceptance criterion 11 and CLAUDE.md section 2 item 4: no credential of
 * ours and nothing belonging to a client reaches a log line. The realistic
 * way one would is a driver's connection error, which carries the URL it was
 * dialling, and that URL has the password in it.
 */
describe("what is allowed into an error field", () => {
  it("takes the password out of a connection URL", () => {
    const error = new Error("Can't reach mysql://awtm:sup3rs3cret@127.0.0.1:3307/awtm");
    const line = safeError(error);
    expect(line).not.toContain("sup3rs3cret");
    expect(line).toContain("REDACTED@");
    // Still says enough to be worth logging.
    expect(line).toContain("127.0.0.1:3307");
  });

  it("takes out anything shaped like a token or a hash", () => {
    const token = "QuzOxfrdPlz7RvYWmC2B7YR0JidJVrRi6CDNWpDztfU";
    expect(safeError(new Error(`no session for ${token}`))).not.toContain(token);
    const hash = "a".repeat(64);
    expect(safeError(new Error(`row ${hash} missing`))).not.toContain(hash);
  });

  it("keeps the name and the message, which is the point of logging it", () => {
    expect(safeError(new TypeError("cannot read x"))).toBe("TypeError: cannot read x");
  });

  it("handles what is thrown that is not an Error, without recursing", () => {
    expect(safeError("plain string")).toBe("plain string");
    expect(safeError(null)).toBe("null");
    expect(safeError({ a: 1 })).toBe("[object Object]");
  });

  it("does not grow without bound, because a stack trace helps nobody here", () => {
    expect(safeError(new Error("x".repeat(5000))).length).toBeLessThanOrEqual(300);
  });
});
