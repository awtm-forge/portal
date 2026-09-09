"use client";

import { useState } from "react";

export function CopyLink({ link }: { link: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="a-btn ghost"
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(link); setDone(true); } catch { setDone(false); }
      }}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}
