"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type MenuLink = { key: string; label: string; href: string; current: boolean };

/**
 * One way between the client's pages, at every width (Ayush, 12 Sep). It
 * replaced the row of small uppercase tabs, which scrolled sideways on a phone
 * and hid whichever page did not fit.
 *
 * Notifications are not in here: they are time sensitive, so the bell stays
 * outside the menu where the count is visible and one tap away (Ayush, 13 Sep).
 *
 * A button and a panel rather than a sidebar: the client portal is one column
 * by design (CLAUDE.md section 2, rule 9), and a menu is quiet, so the one
 * thing to do on a page is still the only loud thing on it.
 */
export function PortalMenu({
  pages,
  whatsapp,
  email,
}: {
  pages: MenuLink[];
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

  return (
    <div className="pmenu" ref={wrap}>
      <button
        type="button"
        className="p-ctl pmenu-btn"
        aria-expanded={open}
        aria-controls="portal-menu"
        aria-label="Menu"
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M18 6 6 18M6 6l12 12" /> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
        </svg>
        <span className="ctl-txt">Menu</span>
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

          <p className="pmenu-head">Reach us</p>
          {whatsapp && <a className="pmenu-out" href={whatsapp} target="_blank" rel="noopener">WhatsApp Rahul</a>}
          <a className="pmenu-out" href={`mailto:${email}`}>Email {email}</a>
          <p className="pmenu-note">Any time, about anything on this page.</p>
        </div>
      )}
    </div>
  );
}
