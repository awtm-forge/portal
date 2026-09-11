"use client";

import { useEffect, useState } from "react";

const COOKIE = "awtm_flash";
const POLL_MS = 400;

/**
 * One line of confirmation, bottom centre, gone after four seconds. It takes
 * the one-shot flash cookie that server actions set (src/lib/flash.ts) and
 * clears it, so a reload does not repeat it. It polls for the cookie rather
 * than reading it once on mount, because a server action that refreshes the
 * same page leaves this component mounted, so there is no mount to catch.
 * The live region is always in the DOM so screen readers hear the change.
 * Hovering holds it.
 */
export function Toast({ message }: { message?: string }) {
  const [text, setText] = useState<string | null>(message ?? null);
  const [on, setOn] = useState(false);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    function take() {
      const m = document.cookie.match(/(?:^|; )awtm_flash=([^;]*)/);
      if (!m) return;
      document.cookie = `${COOKIE}=; Max-Age=0; path=/`;
      let value = m[1];
      try { value = decodeURIComponent(m[1]); } catch { /* shown as it is */ }
      setText(value);
    }
    const t = setInterval(take, POLL_MS);
    const first = setTimeout(take, 0);
    return () => { clearInterval(t); clearTimeout(first); };
  }, []);

  useEffect(() => {
    if (!text) return;
    const show = setTimeout(() => setOn(true), 20);
    return () => clearTimeout(show);
  }, [text]);

  useEffect(() => {
    if (!text || held) return;
    const hide = setTimeout(() => setOn(false), 4200);
    const clear = setTimeout(() => setText(null), 4600);
    return () => { clearTimeout(hide); clearTimeout(clear); };
  }, [text, held]);

  return (
    <div className={`toast${on ? " on" : ""}`} role="status" aria-live="polite" onMouseEnter={() => setHeld(true)} onMouseLeave={() => setHeld(false)}>
      {text}
    </div>
  );
}
