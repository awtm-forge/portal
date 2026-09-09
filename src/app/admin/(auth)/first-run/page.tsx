import { notFound } from "next/navigation";
import { activatedAdminCount } from "@/modules/auth/admin";
import "@/components/portal/portal.css";
import { FirstRunForm } from "./FirstRunForm";

/**
 * ADR 0014. The one screen that can exist before anybody can sign in.
 *
 * It is here at all because Hostinger's Node deploy ships a pruned build with
 * no `scripts/` directory, so the command that makes the first account cannot
 * run on the server. Without a page, a fresh deploy is a working application
 * nobody can enter.
 *
 * It disappears the moment it has been used. Once one admin exists this is a
 * 404 forever, so it is not a back door into a live system, and it never sets
 * a password: it issues the same one-time link the script issues, and the
 * password is chosen on the screen that already does that.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "awtm forge", robots: { index: false, follow: false } };

export default async function FirstRunPage() {
  if ((await activatedAdminCount()) > 0) notFound();
  const configured = Boolean(process.env.SETUP_KEY?.trim());

  return (
    <div className="wayin">
      <div className="wayin-head">
        <span className="c-brand">awtm <b>forge</b></span>
      </div>
      <div className="wayin-body">
        <div className="wayin-card">
          <p className="k">First run</p>
          <h1>There is nobody here yet</h1>
          {configured ? (
            <>
              <p className="lede">
                This database has no admin account, so this page exists once, to make the first one. It closes
                itself the moment you use it and will never open again on this deployment.
              </p>
              <FirstRunForm />
            </>
          ) : (
            <p className="lede">
              This database has no admin account, and no <code>SETUP_KEY</code> is set on the server, so there is
              nothing to check you against. Set one in the hosting panel, restart the app, and come back. Any long
              random string will do, and you can delete it once you are in.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
