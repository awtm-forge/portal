import type { NextConfig } from "next";

// Hostinger's Next.js preset applies output: "standalone" itself and
// requires this file to export a plain object. Do not set output here
// and do not turn this into a function.

const privateZones = ["/p/:path*", "/admin/:path*", "/invoice/:path*", "/agreement/:path*", "/api/:path*"];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return privateZones.map((source) => ({
      source,
      headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "Cache-Control", value: "no-store" },
        { key: "Referrer-Policy", value: "no-referrer" },
      ],
    }));
  },
};

export default nextConfig;
