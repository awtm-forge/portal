"use client";

import { useEffect, useState } from "react";

const words = ["build", "run", "answer"];

export function RotatingWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % words.length), 2200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="rot" aria-live="off">
      <span key={words[index]}>{words[index]}</span>
    </span>
  );
}
