import { describe, expect, it } from "vitest";
import { embedSrc } from "@/lib/booking";

/**
 * Which booking links get rewritten and which are left alone.
 *
 * cal.com is the only service whose parameters we know, so it is the only one
 * we touch. A Google appointment schedule carries its own embed parameter in
 * the address Google hands you, and bolting theme and layout onto it is noise
 * at best (15 Sep).
 */
describe("the booking link we frame", () => {
  it("fills a client's name and email into a cal.com page, so they do not retype them", () => {
    const src = embedSrc("https://cal.com/awtm-forge/connect", "Asha Rao", "asha@example.invalid");
    expect(src).toContain("name=Asha+Rao");
    expect(src).toContain("email=asha%40example.invalid");
    expect(src).toContain("layout=month_view");
  });

  it("leaves a Google appointment schedule exactly as it was pasted", () => {
    const google = "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1abc?gv=true";
    expect(embedSrc(google, "Asha Rao", "asha@example.invalid")).toBe(google);
  });

  it("leaves any other service alone too", () => {
    const calendly = "https://calendly.com/awtm-forge/30min";
    expect(embedSrc(calendly, "Asha", "asha@example.invalid")).toBe(calendly);
  });

  it("frames nothing that is not https", () => {
    expect(embedSrc("http://cal.com/awtm-forge", "Asha", "asha@example.invalid")).toBeNull();
    expect(embedSrc("not a url", "Asha", "asha@example.invalid")).toBeNull();
  });

  it("is not fooled by a host that merely ends in the same letters", () => {
    const impostor = "https://notcal.com/awtm-forge";
    expect(embedSrc(impostor, "Asha", "asha@example.invalid"), "no client details sent there").toBe(impostor);
  });
});
