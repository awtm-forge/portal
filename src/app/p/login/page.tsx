import { ClientShell } from "@/components/portal/ClientShell";
import { LoginForm } from "./LoginForm";

/**
 * Rendered on demand, not prerendered. The shell reads the booking link, the
 * WhatsApp number and the email from settings, and this page was being baked
 * at build time, so a settings change never reached it until the next deploy:
 * a client landing here got last week's Book a meeting button (12 Sep).
 */
export const dynamic = "force-dynamic";

/** Logging in with an email instead of the link (Q18). */
export default function LoginPage() {
  return (
    <ClientShell businessName="Log in">
      <LoginForm />
    </ClientShell>
  );
}
