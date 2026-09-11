"use server";

import { redirect } from "next/navigation";
import { flash } from "@/lib/flash";
import { projectScope } from "../scope";
import { recordThanks, skipThanks } from "@/modules/review";
import "@/modules/notifications/register";

/**
 * The submitted values come back with any error. React resets an uncontrolled
 * form once the action returns, so without this a client who typed a
 * testimonial and tripped the referral check would lose every word of it,
 * moments after signing off. That is the worst place in the journey to lose
 * someone's typing.
 */
export type ThanksState = { message?: string; values?: { quote: string; referralName: string; referralContact: string } };

export async function sendThanksAction(_prev: ThanksState, formData: FormData): Promise<ThanksState> {
  const token = String(formData.get("token") ?? "");
  const { project } = await projectScope(token);
  if (!project.deliveredAt) redirect(`/p/${token}`);

  if (String(formData.get("intent")) === "skip") {
    await skipThanks(project.id);
    await flash("No problem. Everything is still on your page.");
    redirect(`/p/${token}`);
  }

  const quote = String(formData.get("quote") ?? "");
  const name = String(formData.get("referralName") ?? "").trim();
  const contact = String(formData.get("referralContact") ?? "").trim();
  // All or nothing: a name with no way to reach them is a third party's
  // details stored for no purpose.
  if ((name && !contact) || (contact && !name)) {
    return {
      message: "For a referral we need both their name and a way to reach them, or neither.",
      values: { quote, referralName: name, referralContact: contact },
    };
  }

  await recordThanks(project.id, { quote, referralName: name, referralContact: contact });
  await flash("Thank you, we have it.");
  redirect(`/p/${token}`);
}
