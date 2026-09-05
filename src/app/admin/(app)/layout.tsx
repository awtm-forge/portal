import { requireAdmin } from "@/lib/admin-auth";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return children;
}
