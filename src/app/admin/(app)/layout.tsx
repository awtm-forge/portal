import { requireAdmin } from "@/modules/auth/admin";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
