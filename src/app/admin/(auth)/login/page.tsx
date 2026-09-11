import { redirect } from "next/navigation";
import { currentAdmin } from "@/modules/auth/admin";
import "@/components/portal/portal.css";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await currentAdmin()) redirect("/admin");
  return (
    <div className="c-page" style={{ maxWidth: 420 }}>
      <div className="c-head"><span className="c-brand">awtm <b>forge</b></span><span className="k">Team</span></div>
      <div style={{ padding: "38px 20px" }} className="stack">
        <p className="k">Signing in</p>
        <h1 className="c-title" style={{ fontSize: 24, marginTop: 8 }}>Two accounts, no sign-up</h1>
        <LoginForm />
        <p className="help" style={{ marginTop: 22, lineHeight: 1.65 }}>Locked out? The other admin reissues a setup link from Settings, and you choose a new password from it. There is no reset by email.</p>
      </div>
    </div>
  );
}
