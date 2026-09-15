/**
 * WhatsApp for the team's notifications (ADR 0026, Ayush 16 Sep: "For every
 * client notification, can we propagate that to the whatsapp").
 *
 * The same sentence the bell and the email carry, sent to the team's own
 * number through the WhatsApp Business Cloud API. A message a business starts
 * outside a live conversation has to be a template Meta has approved, so this
 * sends one template with three parameters: what happened, one line about
 * it, and the link. The template's text is in DEPLOY.md, where the setup is.
 *
 * Switched on by the values below and off without them, the way SMTP is.
 * Nothing here holds a client's number: every message goes to the team.
 */
const API = "https://graph.facebook.com/v21.0";

const NAMES = ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "TEAM_WHATSAPP_TO"] as const;

function value(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function whatsappMode(): "cloud" | "none" {
  return NAMES.every((n) => value(n) !== "") ? "cloud" : "none";
}

/** Names only, never values, for the health endpoint. */
export function whatsappVars(): { set: string[]; empty: string[] } {
  const set: string[] = [];
  const empty: string[] = [];
  for (const n of NAMES) (value(n) ? set : empty).push(n);
  return { set, empty };
}

/** A template parameter: one line, no control characters, within Meta's cap. */
function param(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 1000) || "-";
}

export type WhatsappResult = { ok: true } | { ok: false; reason: string };

export async function sendTeamWhatsapp(
  args: { what: string; line: string; link: string },
  fetchImpl: typeof fetch = fetch,
): Promise<WhatsappResult> {
  if (whatsappMode() !== "cloud") return { ok: false, reason: "not configured" };
  const to = value("TEAM_WHATSAPP_TO").replace(/\D/g, "");
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: value("WHATSAPP_TEMPLATE") || "awtm_client_activity",
      language: { code: value("WHATSAPP_TEMPLATE_LANG") || "en" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: param(args.what) },
            { type: "text", text: param(args.line) },
            { type: "text", text: param(args.link) },
          ],
        },
      ],
    },
  };
  try {
    const res = await fetchImpl(`${API}/${encodeURIComponent(value("WHATSAPP_PHONE_NUMBER_ID"))}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${value("WHATSAPP_TOKEN")}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    // The status and Meta's own error code, never the request: the token is in it.
    let code = "";
    try {
      const j = (await res.json()) as { error?: { code?: number; message?: string } };
      code = j.error?.code !== undefined ? ` code ${j.error.code}` : "";
    } catch {
      /* no body */
    }
    return { ok: false, reason: `HTTP ${res.status}${code}` };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.name : "network" };
  }
}
