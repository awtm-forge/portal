import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your project, awtm forge",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ClientZoneLayout({ children }: { children: React.ReactNode }) {
  return children;
}
