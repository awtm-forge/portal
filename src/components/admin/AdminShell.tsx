import Link from "next/link";
import "@/components/portal/portal.css";
import { logoutAction } from "@/app/admin/(app)/actions";

export function AdminShell({ active, adminName, children }: { active: "clients" | "projects" | "library" | "settings"; adminName: string; children: React.ReactNode }) {
  return (
    <div className="a-page">
      <aside className="a-side">
        <Link className="a-brand" href="/admin">awtm <b>forge</b></Link>
        <div className="a-navs" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <Link className={`a-nav${active === "clients" ? " on" : ""}`} href="/admin/clients">Clients</Link>
          <Link className={`a-nav${active === "projects" ? " on" : ""}`} href="/admin">Projects</Link>
          <Link className={`a-nav${active === "library" ? " on" : ""}`} href="/admin/library">Image library</Link>
          <Link className={`a-nav${active === "settings" ? " on" : ""}`} href="/admin/settings">Settings</Link>
        </div>
        <div className="signed" style={{ marginTop: "auto", padding: "0 4px", display: "flex", flexDirection: "column", gap: 3 }}>
          <span className="k">Signed in</span>
          <span className="mono-sm">{adminName}</span>
          <form action={logoutAction}><button className="link-mono" type="submit" style={{ padding: 0, fontSize: "10.5px", color: "var(--faint)" }}>Sign out</button></form>
        </div>
      </aside>
      <main className="a-main">{children}</main>
    </div>
  );
}
