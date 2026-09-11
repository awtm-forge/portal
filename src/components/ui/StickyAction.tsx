"use client";

import { useEffect, useState } from "react";

/**
 * Keeps a long page's one action within reach (CLAUDE.md §2 rule 9). While the
 * real control is below the fold, a bar at the foot of the viewport carries a
 * link that scrolls to it and focuses it. It never submits anything itself:
 * agreeing and signing off stay deliberate taps on the real button. It is a
 * link to the control's id, so it works without script and is not a second
 * button with the same name.
 */
export function StickyAction({ targetId, label, hint }: { targetId: string; label: string; hint?: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top > 0),
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [targetId]);

  function go(e: React.MouseEvent<HTMLAnchorElement>) {
    const el = document.getElementById(targetId);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  }

  return (
    <div className={`sticky-act${show ? " on" : ""}`} aria-hidden={!show}>
      <div className="sticky-act-in">
        {hint && <span className="sticky-act-l">{hint}</span>}
        <a href={`#${targetId}`} className="sticky-btn" tabIndex={show ? 0 : -1} onClick={go}>
          {label}
          <span aria-hidden="true"> &darr;</span>
        </a>
      </div>
    </div>
  );
}
