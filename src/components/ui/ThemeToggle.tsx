"use client";

import { useEffect, useState } from "react";
import { readThemeCookie, rememberTheme, type ThemeChoice } from "@/lib/theme";

/**
 * One button on the bar, beside the menu, in both portals (Ayush, 13 Sep).
 *
 * Dark is the default, so this is a switch and not a set of three: it says
 * what it will do rather than what is currently true, which is the one thing
 * a person needs from it. It lived inside the menu for about an hour, and a
 * control nobody can see is a control nobody uses.
 *
 * It writes the cookie and stamps the document itself, so the change is
 * instant and the next page load already knows. Nothing re-renders for it.
 */
export function ThemeToggle({ className = "p-ctl p-ctl-icon" }: { className?: string }) {
  const [choice, setChoice] = useState<ThemeChoice>("dark");

  // The cookie is the truth; this state only decides which glyph shows. Read
  // after mount, because the server render cannot know it, and deferred a tick
  // so it is not a setState inside the effect body.
  useEffect(() => {
    const saved = readThemeCookie();
    const t = setTimeout(() => setChoice(saved), 0);
    return () => clearTimeout(t);
  }, []);

  const next: ThemeChoice = choice === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className={className}
      aria-label={next === "light" ? "Switch to the light theme" : "Switch to the dark theme"}
      title={next === "light" ? "Switch to light" : "Switch to dark"}
      onClick={() => {
        setChoice(next);
        rememberTheme(next);
      }}
    >
      {choice === "dark" ? (
        // A sun: press it and the page becomes paper.
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // A moon: press it and the page goes back to the dark it starts in.
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
