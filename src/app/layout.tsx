import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Newsreader } from "next/font/google";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

// No optical-size axis: only the unrouted marketing stylesheet set it, and the
// axis was 30 KB on the critical path of every client page.
const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
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
    // suppressHydrationWarning: the script below stamps data-theme on this
    // element before React loads, so a person who chose light never sees a
    // dark flash. The server cannot know the choice, so the attribute is a
    // deliberate difference rather than a bug (src/lib/theme.ts).
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        {/* One boot script for every zone, in the head so it runs while the
            document is still parsing and nothing paints before the theme is
            settled. It reads a cookie and nothing else, so the marketing
            routes stay static; in production those sit on their own hostname
            and never see the portal's cookie anyway. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
