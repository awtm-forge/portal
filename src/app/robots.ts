import type { MetadataRoute } from "next";

/**
 * The whole host is private. It serves the portal and the admin only, so
 * there is nothing here to index and no exception worth carving out
 * (ADR 0012). The marketing site, when it returns, gets its own host.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
