import { describe, expect, it } from "vitest";
import { addDays, financialYear, fromIsoDate, isoDate, istParts } from "@/lib/dates";

describe("dates in Asia/Kolkata, PORTAL-SPEC 5.7", () => {
  it("puts the financial year boundary at 1 April, IST", () => {
    expect(financialYear(new Date("2026-04-01T00:00:00+05:30"))).toBe("26-27");
    expect(financialYear(new Date("2026-03-31T23:59:00+05:30"))).toBe("25-26");
    expect(financialYear(new Date("2027-03-31T23:59:00+05:30"))).toBe("26-27");
    expect(financialYear(new Date("2027-04-01T00:00:00+05:30"))).toBe("27-28");
  });

  it("uses the Indian calendar day, not the server's", () => {
    // 31 March 2026, 20:00 UTC is already 1 April in Kolkata.
    const at = new Date("2026-03-31T20:00:00Z");
    expect(istParts(at)).toEqual({ year: 2026, month: 4, day: 1 });
    expect(financialYear(at)).toBe("26-27");
  });

  it("round-trips a date input value without drifting a day", () => {
    for (const value of ["2026-01-01", "2026-04-01", "2026-12-31", "2027-03-31"]) {
      const at = fromIsoDate(value);
      expect(at).not.toBeNull();
      expect(isoDate(at)).toBe(value);
    }
    expect(fromIsoDate("not a date")).toBeNull();
  });

  it("adds thirty days for the day-30 unlock", () => {
    const delivered = new Date("2026-10-14T10:00:00+05:30");
    expect(isoDate(addDays(delivered, 30))).toBe("2026-11-13");
  });
});
