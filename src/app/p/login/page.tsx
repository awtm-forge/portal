import { ClientShell } from "@/components/portal/ClientShell";
import { LoginForm } from "./LoginForm";

/** Logging in with an email instead of the link (Q18). */
export default function LoginPage() {
  return (
    <ClientShell businessName="Log in">
      <LoginForm />
    </ClientShell>
  );
}
