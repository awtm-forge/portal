"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type MenuLink = { key: string; label: string; href: string; current: boolean };

/**
 * One way between the client's pages, at every width (Ayush, 12 Sep). It
 * replaces the row of small uppercase tabs, which scrolled sideways on a phone
 * and hid whichever page did not fit, and it takes in the bell and Reach us so
 * the header holds two controls instead of four.
 *
 * A button and a panel rather than a sidebar: the client portal is one column
 * by design (CLAUDE.md section 2, rule 9), and a menu is quiet, so the one
 * thing to do on a page is still the only loud thing on it.
 */
export function PortalMenu({
  pages,
  updatesHref,
  unread,
  whatsapp,
  email,
}: {
  pages: MenuLink[];
  updatesHref: string;
  unread: number;
  whatsapp: string | null;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const here = pages.find((p) => p.current);

  return (
    <div className="pmenu" ref={wrap}>
      <button
        type="button"
        className="p-pill pmenu-btn"
        aria-expanded={open}
        aria-controls="portal-menu"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M18 6 6 18M6 6l12 12" /> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
        </svg>
        <span>Menu</span>
        {unread > 0 && !open && <span className="p-bell-dot">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="pmenu-panel" id="portal-menu">
          {/* The same label the row carried, so what a page is called does not
              change with where you happen to be reading it. */}
          <nav aria-label="Your pages">
            {pages.map((p) => (
              <Link
                key={p.key}
                href={p.href}
                aria-current={p.current ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                {p.label}
                {/* aria-hidden: aria-current already tells a screen reader
                    which page this is, and without it the link's name becomes
                    "Your pageYou are here". */}
                {p.current && <span className="pmenu-here" aria-hidden="true">You are here</span>}
              </Link>
            ))}
          </nav>

          <Link className="pmenu-updates" href={updatesHref} aria-current={here ? undefined : "page"} onClick={() => setOpen(false)}>
            Updates
            {unread > 0 && <span className="p-bell-dot static">{unread > 9 ? "9+" : unread}</span>}
          </Link>

          <p className="pmenu-head">Reach us</p>
          {whatsapp && <a className="pmenu-out" href={whatsapp} target="_blank" rel="noopener">WhatsApp Rahul</a>}
          <a className="pmenu-out" href={`mailto:${email}`}>Email {email}</a>
          <p className="pmenu-note">Any time, about anything on this page.</p>
        </div>
      )}
    </div>
  );
}
