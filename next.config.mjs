// Hostinger's Next.js preset applies output: "standalone" itself and
// requires this file to export a plain object. Do not set output here
// and do not turn this into a function.
//
// Plain JavaScript, not TypeScript: Hostinger's build host has glibc older
// than 2.29, so Next's native SWC binary cannot load and a .ts config fails
// to transpile against the WASM fallback.

// This host serves the portal and the admin only; the marketing site is no
// longer routed here (ADR 0012), so the root is private too. Listed zone by
// zone rather than as one catch-all, because a catch-all would also put
// no-store on Next's content-hashed static assets, which are safe to cache
// forever. These are the zones PORTAL-SPEC criterion 18 names, plus "/".
const privateZones = ["/", "/healthz", "/p/:path*", "/admin/:path*", "/invoice/:path*", "/agreement/:path*", "/api/:path*"];

/** @type {import("next").NextConfig} */
const nextConfig = {
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
