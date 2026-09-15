"use server";

import { refreshWith } from "@/lib/admin-nav";
import { z } from "zod";
import { COUNTRY_CODE_MESSAGE, hasCountryCode } from "@/lib/phone";
import { db } from "@/lib/db";
import { reauthenticateAdmin, requireAdmin } from "@/modules/auth/admin";
import { goLive, startClean, START_CLEAN_PHRASE } from "@/modules/clients/rehearsal";
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

/**
 * The clean start, in rehearsal only (ADR 0023). Three things before anything
 * happens: the phrase typed, a reason, and the admin's own password, checked
 * last so a typo in the phrase spends none of its five tries.
 */
export async function startCleanAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const back = "/admin/settings";
  const phrase = String(formData.get("phrase") ?? "").trim().toLowerCase();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);
  const password = String(formData.get("password") ?? "");
  if (phrase !== START_CLEAN_PHRASE) await refreshWith(back, `Not started clean: type "${START_CLEAN_PHRASE}" exactly.`);
  if (!reason) await refreshWith(back, "Not started clean: say why, in a line. It is the one thing that survives.");
  const auth = await reauthenticateAdmin(admin.id, password);
  if (auth === "rate_limited") await refreshWith(back, "Not started clean: too many wrong passwords. Wait fifteen minutes.");
  if (auth !== "ok") await refreshWith(back, "Not started clean: that is not your password.");
  const result = await startClean({ adminId: admin.id, adminName: admin.name }, reason);
  if (!result.ok) {
    await refreshWith(back, "Not started clean: the portal is live, and nothing that is evidence can be removed now.");
    return;
  }
  await refreshWith(
    back,
    `Started clean. ${result.before.clients} clients and everything of theirs are gone, and the next invoice is 0001. Rehearsal continues until you mark the portal live.`,
  );
}

/** One way, behind the password. After it, Start clean is gone for good. */
export async function markLiveAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const back = "/admin/settings";
  const auth = await reauthenticateAdmin(admin.id, String(formData.get("password") ?? ""));
  if (auth === "rate_limited") await refreshWith(back, "Not marked live: too many wrong passwords. Wait fifteen minutes.");
  if (auth !== "ok") await refreshWith(back, "Not marked live: that is not your password.");
  await goLive({ adminId: admin.id, adminName: admin.name });
  await refreshWith(back, "The portal is live. From now on nothing that is evidence can be removed.");
}
