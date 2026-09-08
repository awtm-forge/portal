const IST = "Asia/Kolkata";

export function dayMonth(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: IST }).format(d);
}

export function dayMonthTime(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: IST }).format(d);
}

export function longDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: IST }).format(d);
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/** Digits only, for a wa.me link. Here rather than in crypto.ts because a
 *  client component reaches it through whatsapp.ts, and crypto.ts pulls in
 *  node:crypto, which cannot go in a browser bundle. */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}
