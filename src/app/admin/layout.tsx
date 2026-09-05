import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin, awtm forge",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function AdminZoneLayout({ children }: { children: React.ReactNode }) {
  return children;
}
