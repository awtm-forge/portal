"use server";

import { refreshWith } from "@/lib/admin-nav";
import { z } from "zod";
import { COUNTRY_CODE_MESSAGE, hasCountryCode } from "@/lib/phone";
import { db } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/admin";
import { COMPANY_ID } from "@/modules/settings";

export type SettingsState = { message?: string; ok?: string };

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(500),
  email: z.string().trim().email().max(200),
  // Optional, but if it is there it has to be diallable: every client page
  // offers WhatsApp, and a number without its country code makes a link that
  // silently goes nowhere (12 Sep).
  phone: z.string().trim().max(40).refine((v) => v === "" || hasCountryCode(v), COUNTRY_CODE_MESSAGE),
  bankName: z.string().trim().max(120),
  bankAccountName: z.string().trim().max(120),
  bankAccountNumber: z.string().trim().max(40),
  bankIfsc: z.string().trim().max(20),
  upiId: z.string().trim().max(80),
  invoicePrefix: z.string().trim().regex(/^[A-Z0-9]{2,8}$/, "two to eight capitals or digits"),
  gstin: z.string().trim().max(20),
  bookingUrl: z.string().trim().max(300),
  defaultAdvancePct: z.coerce.number().int().min(0).max(100),
});

export async function saveSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { message: `${first.path.join(".")}: ${first.message}` };
  }
  const d = parsed.data;
  if (d.bookingUrl && !/^https?:\/\//i.test(d.bookingUrl)) {
    return { message: "The booking link needs to start with https." };
  }
  // PORTAL-SPEC 5.7: the prefix is part of every invoice number, so changing
  // it after invoices exist would break the sequence a client has seen.
  const issued = await db.invoice.count();
  const current = await db.company.findUnique({ where: { id: COMPANY_ID } });
  if (issued > 0 && current && current.invoicePrefix !== d.invoicePrefix) {
    return { message: `Invoices already carry the prefix ${current.invoicePrefix}. Changing it now would break the numbering a client has seen.` };
  }

  await db.company.upsert({
    where: { id: COMPANY_ID },
    create: {
      id: COMPANY_ID,
      name: d.name,
      address: d.address,
      email: d.email,
      phone: d.phone,
      bankName: d.bankName || null,
      bankAccountName: d.bankAccountName || null,
      bankAccountNumber: d.bankAccountNumber || null,
      bankIfsc: d.bankIfsc || null,
      upiId: d.upiId || null,
      invoicePrefix: d.invoicePrefix,
      gstin: d.gstin || null,
      bookingUrl: d.bookingUrl || null,
      defaultAdvancePct: d.defaultAdvancePct,
    },
    update: {
      name: d.name,
      address: d.address,
      email: d.email,
      phone: d.phone,
      bankName: d.bankName || null,
      bankAccountName: d.bankAccountName || null,
      bankAccountNumber: d.bankAccountNumber || null,
      bankIfsc: d.bankIfsc || null,
      upiId: d.upiId || null,
      invoicePrefix: d.invoicePrefix,
      gstin: d.gstin || null,
      bookingUrl: d.bookingUrl || null,
      defaultAdvancePct: d.defaultAdvancePct,
    },
  });
  return refreshWith("/admin/settings", "Settings saved.");
}
