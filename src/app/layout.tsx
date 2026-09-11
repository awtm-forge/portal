import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

// Upright only, no optical-size axis: nothing in the product sets italic, and
// the two extra files were 273 KB preloaded ahead of every client page's text
// (docs/ux-overhaul/03-baseline-metrics.md).
const body = Newsreader({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "awtm forge",
  description:
    "Storefronts, apps and the systems behind them. From the first build to the month after launch, one team accountable for everything between your product and your customer.",
  metadataBase: new URL("https://awtmforge.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
