"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const BEHIND = "awtm_nav_behind";
const AHEAD = "awtm_nav_ahead";
const MOVED = "awtm_nav_moved";

/**
 * Back and forward, inside the page (Ayush, 13 Sep).
 *
 * Added for the client, who opens their link from WhatsApp's in-app browser
 * with little chrome of its own; the client header let them go the same day,
 * because inside a one-page portal they read as browser furniture. The admin
 * keeps the pair, where a deep tree (clients, a client, a project, its
 * agreement) makes them earn their place. Since 16 Sep they sit at the two
 * corners of the admin's page pane rather than in the sidebar's top row,
 * which was four things in one short line (Ayush: crowded; his idea was left
 * and right of the page). With `words`, each carries its name beside the
 * chevron, which a lone glyph at the far corner of a wide pane needs.
 *
 * It drives the real history: history.back() and history.forward(), never a
 * second stack of our own, so the browser's own buttons and these two can
 * never disagree. The counters in sessionStorage only decide whether an arrow
 * is worth offering, so the worst a wrong count can do is dim a button, never
 * throw someone out of the portal.
 */
function read(key: string): number {
  try {
    return Math.max(0, Number(sessionStorage.getItem(key) ?? "0") || 0);
  } catch {
    return 0;
  }
}
function write(key: string, n: number) {
  try {
    sessionStorage.setItem(key, String(Math.max(0, n)));
  } catch {
    /* a private window with storage off: the arrows simply stay dim */
  }
}

export function HistoryNav({ words = false }: { words?: boolean }) {
  const pathname = usePathname();
  const [behind, setBehind] = useState(0);
  const [ahead, setAhead] = useState(0);

  useEffect(() => {
    // A move this component made is not a new step; it has already counted it.
    let moved = false;
    try {
      moved = sessionStorage.getItem(MOVED) === "1";
      if (moved) sessionStorage.removeItem(MOVED);
    } catch {
      /* storage off */
    }
    if (!moved) {
      // A fresh navigation: one more place to go back to, and nothing ahead.
      write(BEHIND, read(BEHIND) + 1);
      write(AHEAD, 0);
    }
    const b = read(BEHIND);
    const a = read(AHEAD);
    const t = setTimeout(() => {
      setBehind(b);
      setAhead(a);
    }, 0);
    return () => clearTimeout(t);
  }, [pathname]);

  const step = useCallback((direction: -1 | 1) => {
    try {
      sessionStorage.setItem(MOVED, "1");
    } catch {
      /* storage off */
    }
    if (direction === -1) {
      write(BEHIND, read(BEHIND) - 1);
      write(AHEAD, read(AHEAD) + 1);
      window.history.back();
    } else {
      write(BEHIND, read(BEHIND) + 1);
      write(AHEAD, read(AHEAD) - 1);
      window.history.forward();
    }
  }, []);

  // Named "Go back", not "Back": the questionnaire, which the team can fill
  // in too, has its own Back, which moves between sections rather than pages,
  // and two controls with the same name on one screen is a poor thing to hand
  // a screen reader. The visible word is "Back", which the name contains.
  // One step behind is the page they arrived on, so there is nowhere useful
  // to go until they have moved at least once inside the portal.
  const canBack = behind > 1;
  const canForward = ahead > 0;

  // Drawn at 20 rather than 16 (Ayush, 15 Sep: "bigger"). A chevron is six
  // units wide in a 24 unit box, so at the bell's size it read as a sliver
  // beside a bell that fills its box; 20 with a slightly heavier stroke puts
  // the two on a par to the eye.

  return (
    <div className={`histnav${words ? " histnav-w" : ""}`}>
      <button type="button" className="histnav-b" onClick={() => step(-1)} disabled={!canBack} aria-label="Go back">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        {words && <span className="ctl-txt">Back</span>}
      </button>
      <button type="button" className="histnav-b" onClick={() => step(1)} disabled={!canForward} aria-label="Go forward">
        {words && <span className="ctl-txt">Forward</span>}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
      </button>
    </div>
  );
}
