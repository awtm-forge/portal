import { Toast } from "@/components/ui/Toast";
import { requireAdmin } from "@/modules/auth/admin";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  // The toast lives here, not in the shell each page renders: a server action
  // that refreshes the page remounts the shell, and a toast remounted in the
  // middle of taking the one-shot flash cookie lost the line on CI's slower
  // runner. The layout is kept across that refresh, so this one is not.
  return (
    <>
      {children}
      <Toast />
    </>
  );
}
