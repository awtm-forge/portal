import { db } from "@/lib/db";

/**
 * The company singleton, read through one function so a screen cannot forget
 * a default. A new setting is a key with a default in modules/settings, not a
 * migration (ARCHITECTURE.md).
 */
export const COMPANY_ID = "company";

export type CompanyView = {
  id: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  upiId: string | null;
  invoicePrefix: string;
  gstin: string | null;
  bookingUrl: string | null;
  defaultAdvancePct: number;
};

const FALLBACK: Omit<CompanyView, "id"> = {
  name: "awtm forge",
  address: "Bengaluru, Karnataka",
  email: "hello@awtmforge.com",
  phone: "",
  bankName: null,
  bankAccountName: null,
  bankAccountNumber: null,
  bankIfsc: null,
  upiId: null,
  invoicePrefix: "AWTM",
  gstin: null,
  bookingUrl: null,
  defaultAdvancePct: 50,
};

/** Never throws. A missing row means the seed has not run, not a broken page. */
export async function company(): Promise<CompanyView> {
  const row = await db.company.findUnique({ where: { id: COMPANY_ID } });
  if (!row) return { id: COMPANY_ID, ...FALLBACK };
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    email: row.email,
    phone: row.phone,
    bankName: row.bankName,
    bankAccountName: row.bankAccountName,
    bankAccountNumber: row.bankAccountNumber,
    bankIfsc: row.bankIfsc,
    upiId: row.upiId,
    invoicePrefix: row.invoicePrefix,
    gstin: row.gstin,
    bookingUrl: row.bookingUrl,
    defaultAdvancePct: row.defaultAdvancePct,
  };
}

/** PORTAL-SPEC 5.8: a tax line exists only once a GSTIN does. */
export function chargesGst(c: CompanyView): boolean {
  return c.gstin !== null && c.gstin.trim() !== "";
}

/**
 * Whether the portal is live (ADR 0023). Until this is set, everything in the
 * portal counts as rehearsal and can be wiped in one go from settings; once
 * set, that control is gone for good and the evidence rules hold. The first
 * key in the Setting table, read and written only here.
 */
const LIVE_KEY = "live_since";

export async function liveSince(reader: Pick<typeof db, "setting"> = db): Promise<Date | null> {
  const row = await reader.setting.findUnique({ where: { key: LIVE_KEY } });
  if (!row) return null;
  const at = new Date(row.value);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** One way. A second call changes nothing: the first date stands. */
export async function setLive(): Promise<Date> {
  const at = new Date();
  await db.setting.upsert({
    where: { key: LIVE_KEY },
    create: { key: LIVE_KEY, value: at.toISOString(), type: "datetime" },
    update: {},
  });
  return (await liveSince()) ?? at;
}
