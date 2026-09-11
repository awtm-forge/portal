"use server";

import { redirect } from "next/navigation";
import { flash } from "@/lib/flash";
import { projectScope } from "../scope";
import { submit } from "@/modules/day30";
import "@/modules/notifications/register";

/**
 * The typed values come back with any error, for the same reason the
 * thank-you page does it: React resets an uncontrolled form once the action
 * returns, and losing someone's words is a poor way to thank them.
 */
export type Day30State = {
  message?: string;
  values?: { metricAfter: string; quote: string; useName: boolean; useLogo: boolean };
};

export async function submitDay30Action(_prev: Day30State, formData: FormData): Promise<Day30State> {
  const token = String(formData.get("token") ?? "");
  const { project } = await projectScope(token);

  const values = {
    metricAfter: String(formData.get("metricAfter") ?? ""),
    quote: String(formData.get("quote") ?? ""),
    useName: formData.get("useName") === "on",
    useLogo: formData.get("useLogo") === "on",
  };

  const result = await submit(project.id, values);
  if (!result.ok) {
    const why = {
      not_open: "This page is not open yet.",
      already_answered: "You have already answered this one.",
    }[result.reason];
    return { message: why, values };
  }
  await flash("Thank you. That is everything we needed.");
  redirect(`/p/${token}`);
}
