import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTeamWhatsapp, whatsappMode, whatsappVars } from "@/lib/whatsapp-cloud";

/**
 * ADR 0026. Off without its values, on with them, one template with three
 * parameters to the team's number, and a failure that names the status and
 * Meta's code without ever repeating the request.
 */
const NAMES = ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "TEAM_WHATSAPP_TO", "WHATSAPP_TEMPLATE", "WHATSAPP_TEMPLATE_LANG"];
const saved: Record<string, string | undefined> = {};
for (const n of NAMES) saved[n] = process.env[n];
afterEach(() => {
  for (const n of NAMES) {
    if (saved[n] === undefined) delete process.env[n];
    else process.env[n] = saved[n];
  }
});

function configured() {
  process.env.WHATSAPP_TOKEN = "test-token-never-logged";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
  process.env.TEAM_WHATSAPP_TO = "+91 98765 43210";
}

describe("WhatsApp for the team", () => {
  it("is off while any value is missing, and says which by name", () => {
    delete process.env.WHATSAPP_TOKEN;
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
    process.env.TEAM_WHATSAPP_TO = "919876543210";
    expect(whatsappMode()).toBe("none");
    expect(whatsappVars()).toEqual({ set: ["WHATSAPP_PHONE_NUMBER_ID", "TEAM_WHATSAPP_TO"], empty: ["WHATSAPP_TOKEN"] });
  });

  it("sends one template with three one-line parameters to the team's number, digits only", async () => {
    configured();
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    const result = await sendTeamWhatsapp({ what: "Kavya Appliances: sent 2 files", line: "Kavya Appliances uploaded logo.png,\nphoto.jpg.", link: "https://dashboard.awtmforge.com/admin/clients/abc" }, fetchImpl);
    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://graph.facebook.com/v21.0/123456/messages");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer test-token-never-logged");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.to).toBe("919876543210");
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("awtm_client_activity");
    expect(body.template.language.code).toBe("en");
    expect(body.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual([
      "Kavya Appliances: sent 2 files",
      "Kavya Appliances uploaded logo.png, photo.jpg.",
      "https://dashboard.awtmforge.com/admin/clients/abc",
    ]);
  });

  it("names the status and Meta's code on failure, never the request", async () => {
    configured();
    const fetchImpl = (async () => new Response(JSON.stringify({ error: { code: 190, message: "bad token" } }), { status: 401 })) as typeof fetch;
    const result = await sendTeamWhatsapp({ what: "x", line: "y", link: "z" }, fetchImpl);
    expect(result).toEqual({ ok: false, reason: "HTTP 401 code 190" });
    expect(JSON.stringify(result)).not.toContain("test-token-never-logged");
  });

  it("refuses to send at all while not configured", async () => {
    delete process.env.WHATSAPP_TOKEN;
    const spy = vi.fn();
    const result = await sendTeamWhatsapp({ what: "x", line: "y", link: "z" }, spy as unknown as typeof fetch);
    expect(result).toEqual({ ok: false, reason: "not configured" });
    expect(spy).not.toHaveBeenCalled();
  });
});
