"use client";

import { useEffect, useState } from "react";
import { applyTheme, readThemeCookie, rememberTheme, THEME_CHOICES, type ThemeChoice } from "@/lib/theme";

/**
 * Light, dark, or whatever the device says. Three buttons rather than a two
 * way switch: with a switch there is no way back to following the device, and
 * following the device is the right default for a page people open at night
 * from a message.
 *
 * It writes the cookie and stamps the document itself, so the change is
 * instant and the next page load already knows. Nothing re-renders for it.
 */
const LABEL: Record<ThemeChoice, string> = { system: "Device", light: "Light", dark: "Dark" };

export function ThemePick() {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  // The cookie is the truth; this state only decides which button looks
  // chosen. Read after mount, because the server render cannot know it, and
  // deferred a tick so it is not a setState inside the effect body.
  useEffect(() => {
    const saved = readThemeCookie();
    const t = setTimeout(() => setChoice(saved), 0);
    return () => clearTimeout(t);
  }, []);

  // Following the device means following it while the page is open, too.
  useEffect(() => {
    if (choice !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const follow = () => applyTheme("system");
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, [choice]);

  function pick(next: ThemeChoice) {
    setChoice(next);
    rememberTheme(next);
  }

  return (
    <div className="themepick">
      <span className="themepick-lbl" id="theme-pick-label">Theme</span>
      <div className="themepick-row" role="group" aria-labelledby="theme-pick-label">
        {THEME_CHOICES.map((option) => (
          <button
            key={option}
            type="button"
            className="themepick-b"
            aria-pressed={choice === option}
            onClick={() => pick(option)}
          >
            {LABEL[option]}
          </button>
        ))}
      </div>
    </div>
  );
}
