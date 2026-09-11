"use client";

import { useEffect, useState } from "react";

const WAIT = 30;

/**
 * "Send it again" for the code screens. After a tap it counts down thirty
 * seconds so a second tap is not mistaken for a dead one (F-15). The server's
 * own limit is untouched; this only shows it. It submits the form it sits in.
 */
export function ResendButton({ pending, name = "intent", value = "resend", block = false }: { pending: boolean; name?: string; value?: string; block?: boolean }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <button
      className="link-mono"
      type="submit"
      name={name}
      value={value}
      disabled={pending || left > 0}
      onClick={() => setLeft(WAIT)}
      style={block ? { display: "block", width: "100%", textAlign: "center", padding: "12px 0" } : { textAlign: "center" }}
    >
      {left > 0 ? `Sent. Ask again in ${left} s` : "Send it again"}
    </button>
  );
}
