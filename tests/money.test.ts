import { describe, expect, it } from "vitest";
import { amountInWords, formatRupees, parseRupeesToPaise, splitAdvance } from "@/lib/money";

describe("money, ADR 0004 and acceptance criterion 12", () => {
  it("groups rupees the Indian way", () => {
    expect(formatRupees(48000000n)).toBe("Rs 4,80,000");
    expect(formatRupees(100000n)).toBe("Rs 1,000");
    expect(formatRupees(1234567890n)).toBe("Rs 1,23,45,678.90");
    expect(formatRupees(0n)).toBe("Rs 0");
    expect(formatRupees(50n)).toBe("Rs 0.50");
  });

  it("writes the amount in words to match the figure", () => {
    expect(amountInWords(48000000n)).toBe("Four lakh eighty thousand rupees only");
    expect(amountInWords(100000n)).toBe("One thousand rupees only");
    expect(amountInWords(4500000n)).toBe("Forty five thousand rupees only");
    expect(amountInWords(1000000000n)).toBe("One crore rupees only");
    expect(amountInWords(12345678n)).toBe("One lakh twenty three thousand four hundred and fifty six rupees and seventy eight paise only");
    expect(amountInWords(0n)).toBe("Zero rupees only");
  });

  it("splits the advance so the two invoices always sum to the total", () => {
    for (const total of [48000000n, 1n, 99n, 33333333n, 7n, 123456789n]) {
      for (const pct of [0, 1, 33, 50, 66, 99, 100]) {
        const { advance, balance } = splitAdvance(total, pct);
        expect(advance + balance).toBe(total);
        expect(advance).toBeGreaterThanOrEqual(0n);
        expect(balance).toBeGreaterThanOrEqual(0n);
      }
    }
  });

  it("rounds the advance down, never up", () => {
    expect(splitAdvance(999n, 50)).toEqual({ advance: 499n, balance: 500n });
    expect(splitAdvance(48000000n, 50)).toEqual({ advance: 24000000n, balance: 24000000n });
  });

  it("refuses a percentage that is not a whole number from 0 to 100", () => {
    expect(() => splitAdvance(100n, 50.5)).toThrow();
    expect(() => splitAdvance(100n, 101)).toThrow();
    expect(() => splitAdvance(100n, -1)).toThrow();
  });

  it("parses what an admin types, and refuses what it cannot", () => {
    expect(parseRupeesToPaise("480000")).toBe(48000000n);
    expect(parseRupeesToPaise("4,80,000")).toBe(48000000n);
    expect(parseRupeesToPaise("4,80,000.50")).toBe(48000050n);
    expect(parseRupeesToPaise("Rs 1,000")).toBe(100000n);
    expect(parseRupeesToPaise("")).toBeNull();
    expect(parseRupeesToPaise("about four lakh")).toBeNull();
    expect(parseRupeesToPaise("1.234")).toBeNull();
  });
});
