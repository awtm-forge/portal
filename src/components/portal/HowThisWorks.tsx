"use client";

import { useEffect, useState } from "react";
import { STAGES, STAGE_NOTES } from "@/content/client-home";

/**
 * The whole journey, in five rows: the stage, what happens in it, and how long
 * it usually takes. It reads the same notes the rail opens, so the two can
 * never say different things.
 *
 * Open by default until the questionnaire is behind them, because a first-time
 * client should not have to go looking for what happens next; folded after
 * that, because by then they have seen it. Whichever they choose is remembered
 * on their device, per client, so a returning client gets their own answer
 * rather than ours.
 */
export function HowThisWorks({ clientKey, openByDefault }: { clientKey: string; openByDefault: boolean }) {
  const [open, setOpen] = useState(openByDefault);
  const key = `awtm_how_${clientKey}`;

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(key);
    } catch {
      /* a private window with storage off: the default stands */
    }
    if (saved !== "1" && saved !== "0") return;
    // Deferred a tick: a setState in an effect body cascades a render.
    const t = setTimeout(() => setOpen(saved === "1"), 0);
    return () => clearTimeout(t);
  }, [key]);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(key, next ? "1" : "0");
    } catch {
      /* storage off */
    }
  }

  return (
    <section className="how">
      <button type="button" className="how-b" aria-expanded={open} aria-controls="how-body" onClick={toggle}>
        <span>How this works</span>
        <svg className="how-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <div className={`how-wrap${open ? " is-open" : ""}`} id="how-body" role="region" aria-label="How this works">
        <div className="how-inner">
          <ol className="how-list">
            {STAGES.map((s) => (
              <li key={s.key}>
                <p className="how-name">{s.label}</p>
                <p className="how-what">{STAGE_NOTES[s.key].what}</p>
                <p className="how-long">{STAGE_NOTES[s.key].how_long}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
