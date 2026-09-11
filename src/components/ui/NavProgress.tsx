"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * A thin ember line along the top while a tap is on its way to another page
 * (F-01). It starts on a click of any same-origin link and ends when the
 * pathname changes; a safety timer ends it if the navigation never lands.
 *
 * Deliberately not a loading.tsx skeleton: that makes Next stream the page,
 * and a notFound() thrown after the shell has gone out can no longer set the
 * status, so the thank-you and day-30 pages stopped being real 404s.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [from, setFrom] = useState<string | null>(null);
  const busy = from !== null && from === pathname;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      let url: URL;
      try { url = new URL(a.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setFrom(window.location.pathname);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setFrom(null), 8000);
    return () => clearTimeout(t);
  }, [busy]);

  return <div className={`nav-progress${busy ? " on" : ""}`} aria-hidden="true" />;
}
