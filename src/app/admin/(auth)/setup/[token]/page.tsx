import { notFound } from "next/navigation";
import { hashToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import "@/components/portal/portal.css";
import { SetupForm } from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function AdminSetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await db.adminUser.findUnique({ where: { setupTokenHash: hashToken(token) } });
  if (!user || !user.setupExpiresAt || user.setupExpiresAt < new Date()) notFound();

  return (
    <div className="c-page" style={{ maxWidth: 420 }}>
      <div className="c-head"><span className="c-brand">awtm <b>forge</b></span><span className="k">Team</span></div>
      <div style={{ padding: "38px 20px" }} className="stack">
        <p className="k">Setting up</p>
        <h1 className="c-title" style={{ fontSize: 24, marginTop: 8 }}>Choose your password</h1>
        <p className="c-sub" style={{ marginTop: 10 }}>
          For {user.email}. Nobody made one for you, and nobody else has seen this link. It works once.
        </p>
        <SetupForm token={token} />
      </div>
    </div>
  );
}
