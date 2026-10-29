import { describe, expect, it } from "vitest";
import { opsKeyOk } from "@/modules/ops/read";

// The ops key gate: no key configured means no route; a wrong or short key is refused; only the exact key passes.
describe("ops read key", () => {
  it("is off when OPS_API_KEY is unset", () => { delete process.env.OPS_API_KEY; expect(opsKeyOk("anything")).toBe(false); });
  it("refuses a wrong or missing header", () => {
    process.env.OPS_API_KEY = "k-" + "x".repeat(30);
    expect(opsKeyOk(null)).toBe(false); expect(opsKeyOk("k-" + "y".repeat(30))).toBe(false); expect(opsKeyOk("short")).toBe(false);
  });
  it("accepts the exact key", () => { process.env.OPS_API_KEY = "k-" + "x".repeat(30); expect(opsKeyOk("k-" + "x".repeat(30))).toBe(true); });
});
