import { describe, expect, it } from "vitest";
import { bookingLink, embedSrc } from "@/lib/booking";

/**
 * Which booking links get rewritten and which are left alone.
 *
 * cal.com is the only service whose parameters we know, so it is the only one
 * we touch. A Google appointment schedule carries its own embed parameter in
 * the address Google hands you, and bolting ours onto it is noise at best
 * (15 Sep). The link is shared by the client's booking page and the team's
 * Book a meeting on a client's admin page, so both are pinned here.
 */
describe("the booking link with a client's details on it", () => {
  it("fills a client's name and email into a cal.com page, so they do not retype them", () => {
    const link = bookingLink("https://cal.com/awtm-forge/connect", "Asha Rao", "asha@example.invalid");
    expect(link).toContain("name=Asha+Rao");
    expect(link).toContain("email=asha%40example.invalid");
  });

  it("adds nothing else to it, so the team can open the same link in a tab", () => {
    const link = bookingLink("https://cal.com/awtm-forge/connect", "Asha Rao", "asha@example.invalid");
    expect(link).not.toContain("theme=");
    expect(link).not.toContain("layout=");
    expect(link).not.toContain("embed=");
  });

  it("leaves a Google appointment schedule exactly as it was pasted", () => {
    const google = "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1abc?gv=true";
    expect(bookingLink(google, "Asha Rao", "asha@example.invalid")).toBe(google);
  });

  it("leaves any other service alone too", () => {
    const calendly = "https://calendly.com/awtm-forge/30min";
    expect(bookingLink(calendly, "Asha", "asha@example.invalid")).toBe(calendly);
  });

  it("gives nothing for a link that is not https", () => {
    expect(bookingLink("http://cal.com/awtm-forge", "Asha", "asha@example.invalid")).toBeNull();
    expect(bookingLink("not a url", "Asha", "asha@example.invalid")).toBeNull();
  });

  it("is not fooled by a host that merely ends in the same letters", () => {
    const impostor = "https://notcal.com/awtm-forge";
    expect(bookingLink(impostor, "Asha", "asha@example.invalid"), "no client details sent there").toBe(impostor);
  });
});

describe("the same link in embed dress, for the frame", () => {
  it("carries the details and cal.com's own frame parameters", () => {
    const src = embedSrc("https://cal.com/awtm-forge/connect", "Asha Rao", "asha@example.invalid");
    expect(src).toContain("name=Asha+Rao");
    expect(src).toContain("email=asha%40example.invalid");
    expect(src).toContain("theme=dark");
    expect(src).toContain("layout=month_view");
    expect(src).not.toContain("embed=true");
  });

  it("frames a Google appointment schedule exactly as it was pasted", () => {
    const google = "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1abc?gv=true";
    expect(embedSrc(google, "Asha Rao", "asha@example.invalid")).toBe(google);
  });

  it("frames nothing that is not https", () => {
    expect(embedSrc("http://cal.com/awtm-forge", "Asha", "asha@example.invalid")).toBeNull();
  });
});
