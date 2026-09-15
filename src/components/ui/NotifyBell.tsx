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
 *
 * And it keeps itself current (Ayush, 15 Sep: "We have to refresh the page
 * for the notifications to be shown"). Given a route to ask, it asks on
 * mount, whenever the tab comes back into view or the window regains focus,
 * and every thirty seconds while the tab is visible. Polling rather than a
 * held-open connection, because the host stops the process when it is idle
 * and a connection that dies quietly is worse than a question asked again. A
 * fresh arrival after the tray was opened shows its count again.
 */
export function NotifyBell({
  items: initialItems,
  unread: initialUnread,
  allHref,
  className = "p-ctl p-ctl-icon",
  onOpen,
  pollHref,
  pollMs = 30_000,
}: {
  items: Notice[];
  unread: number;
  allHref: string;
  className?: string;
  /** Marks everything seen. Fired once, the first time it is opened. */
  onOpen?: () => Promise<void>;
  /** Where to ask for the current list and count. Without it the bell is what it was rendered with. */
  pollHref?: string;
  pollMs?: number;
}) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const [items, setItems] = useState<Notice[]>(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const wrap = useRef<HTMLDivElement>(null);
  const lastUnread = useRef(initialUnread);

  useEffect(() => {
    if (!pollHref) return;
    let stopped = false;
    async function ask() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(pollHref!, { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) return;
        const data = (await res.json()) as { unread: number; items: Notice[] };
        if (stopped) return;
        setItems(data.items);
        setUnread(data.unread);
        // Something new since the tray was last opened: show the count again.
        if (data.unread > 0 && data.unread !== lastUnread.current) setSeen(false);
        lastUnread.current = data.unread;
      } catch {
        /* offline, or the process is waking: the next tick asks again */
      }
    }
    void ask();
    const timer = setInterval(ask, pollMs);
    const onVisible = () => { if (document.visibilityState === "visible") void ask(); };
    const onFocus = () => void ask();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [pollHref, pollMs]);

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

  // A bell with nothing behind it is a control that does nothing, so it is
  // not there until something is; with a route to ask, it appears on its own
  // the moment the first notice lands.
  if (items.length === 0) return null;

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
