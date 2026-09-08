"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/modules/auth/admin";
import { markPaid, raiseOther, type MarkPaidReason } from "@/modules/invoices";
import "@/modules/notifications/register";

export type InvoiceState = { message?: string; values?: Record<string, string> };

const paidSchema = z.object({
  invoiceId: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  paidOn: z.string().trim().min(1),
  reference: z.string().trim().max(191).default(""),
  method: z.string().trim().max(191).default(""),
});

const WHY_NOT_PAID: Record<MarkPaidReason, string> = {
  not_found: "That invoice is not there any more.",
  not_issued: "That invoice is not waiting to be paid.",
  bad_date: "That date did not read. Use the date picker.",
  future: "That date is in the future.",
  before_issue: "That is before the invoice was raised.",
};

export async function markPaidAction(_prev: InvoiceState, formData: FormData): Promise<InvoiceState> {
  await requireAdmin();
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const parsed = paidSchema.safeParse(values);
  if (!parsed.success) return { message: "Say the day it landed.", values };

  const result = await markPaid(parsed.data.invoiceId, {
    paidOn: parsed.data.paidOn,
    reference: parsed.data.reference,
    method: parsed.data.method,
  });
  if (!result.ok) return { message: WHY_NOT_PAID[result.reason], values };
  redirect(`/admin/projects/${result.projectId}`);
}

/**
 * Acceptance criterion 3: `other` is the only kind an admin can raise. No
 * route reaches issueAdvance or issueBalance; those follow a sign-off and
 * nothing else.
 */
export async function raiseOtherAction(_prev: InvoiceState, formData: FormData): Promise<InvoiceState> {
  await requireAdmin();
  const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const projectId = String(formData.get("projectId") ?? "");

  const result = await raiseOther({
    projectId,
    description: String(formData.get("description") ?? ""),
    rupees: String(formData.get("rupees") ?? ""),
  });
  if (!result.ok) {
    const why = {
      no_description: "Say what it is for. The client reads this line.",
      bad_amount: "The amount needs to be a number of rupees, more than zero.",
      no_project: "That project is not there any more.",
    }[result.reason];
    return { message: why, values };
  }
  redirect(`/admin/projects/${projectId}`);
}
