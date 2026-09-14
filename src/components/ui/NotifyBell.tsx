"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type Notice = { id: string; title: string; body: string; href: string; when: string; unread: boolean };

/**
 * Notifications that behave like notifications: a bell that opens what has
 * happened, in place, rather than a link to a fourth page (Ayush, 14 Sep).
 *
 * The same control in both zones. It is not rendered at all when there is
 * nothing behind it, because a bell with an empty list is a control that does
 * nothing. Opening it marks everything seen, which is what clears the count,
 * and the full list is one link away for anything older than the six shown.
 *
 * It closes on Escape, on a click outside, and on following a line, the same
 * three ways the client's menu closes.
 */
export function NotifyBell({
  items,
  unread,
  allHref,
  className = "p-ctl p-ctl-icon",
  onOpen,
}: {
  items: Notice[];
  unread: number;
  allHref: string;
  className?: string;
  /** Marks everything seen. Fired once, the first time it is opened. */
  onOpen?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
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

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !seen) {
      setSeen(true);
      // The count clears here rather than after a round trip, so the bell
      // answers immediately; the write catches up.
      void onOpen?.();
    }
  }

  const count = seen ? 0 : unread;

  return (
    <div className="notify" ref={wrap}>
      <button
        type="button"
        className={className}
        aria-expanded={open}
        aria-controls="notify-panel"
        aria-label={count > 0 ? `Notifications, ${count} new` : "Notifications"}
        onClick={toggle}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {count > 0 && <span className="notify-dot">{count > 9 ? "9+" : count}</span>}
      </button>

      {open && (
        <div className="notify-panel" id="notify-panel">
          <p className="notify-head">Notifications</p>
          <div className="notify-list">
            {items.map((n) => (
              <Link
                key={n.id}
                className={`notify-row${n.unread && !seen ? " is-new" : ""}`}
                href={n.href}
                onClick={() => setOpen(false)}
              >
                <span className="notify-top">
                  <span className="notify-title">{n.title}</span>
                  <span className="notify-when">{n.when}</span>
                </span>
                <span className="notify-body">{n.body}</span>
              </Link>
            ))}
          </div>
          <Link className="notify-all" href={allHref} onClick={() => setOpen(false)}>
            See all of them
          </Link>
        </div>
      )}
    </div>
  );
}
