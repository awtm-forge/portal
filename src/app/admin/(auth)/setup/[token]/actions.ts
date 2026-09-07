"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { hashToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { adminLogin, hashPassword } from "@/modules/auth/admin";

export type SetupState = { message?: string };

const MIN = 12;

export async function setPasswordAction(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const again = String(formData.get("again") ?? "");

  if (password.length < MIN) return { message: `At least ${MIN} characters. Longer is better than complicated.` };
  if (password !== again) return { message: "The two do not match." };

  const user = await db.adminUser.findUnique({ where: { setupTokenHash: hashToken(token) } });
  if (!user || !user.setupExpiresAt || user.setupExpiresAt < new Date()) {
    return { message: "This link has expired. Ask for a new one to be made." };
  }

  await db.adminUser.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password),
      setupTokenHash: null,
      setupExpiresAt: null,
      setupLinkUsedAt: new Date(),
    },
  });

  // Sign them in so the link ends where they wanted to be.
  await adminLogin(user.email, password, await headers());
  redirect("/admin");
}
