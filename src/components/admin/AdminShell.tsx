import Link from "next/link";
import "@/components/portal/portal.css";
import { logoutAction } from "@/app/admin/(app)/actions";
import { NavProgress } from "@/components/ui/NavProgress";
import { Toast } from "@/components/ui/Toast";

/**
 * The admin frame: a sidebar on a laptop, a sticky top bar with the nav as a
 * scrollable row on a phone. All layout lives in portal.css (the admin block);
 * an inline style here once defeated the phone layout (D-02).
 */
export function AdminShell({ active, adminName, children }: { active: "clients" | "projects" | "library" | "settings"; adminName: string; children: React.ReactNode }) {
  return (
    <div className="a-page">
      <NavProgress />
      <aside className="a-side">
        <Link className="a-brand" href="/admin">awtm <b>forge</b></Link>
        <nav className="a-navs" aria-label="Admin">
          <Link className={`a-nav${active === "clients" ? " on" : ""}`} href="/admin/clients" aria-current={active === "clients" ? "page" : undefined}>Clients</Link>
          <Link className={`a-nav${active === "projects" ? " on" : ""}`} href="/admin" aria-current={active === "projects" ? "page" : undefined}>Projects</Link>
          <Link className={`a-nav${active === "library" ? " on" : ""}`} href="/admin/library" aria-current={active === "library" ? "page" : undefined}>Image library</Link>
          <Link className={`a-nav${active === "settings" ? " on" : ""}`} href="/admin/settings" aria-current={active === "settings" ? "page" : undefined}>Settings</Link>
        </nav>
        <div className="signed">
          <span className="k">Signed in</span>
          <span className="mono-sm">{adminName}</span>
          <form action={logoutAction}><button className="link-mono signout" type="submit">Sign out</button></form>
        </div>
      </aside>
      <main className="a-main">{children}</main>
      <Toast />
    </div>
  );
}
