"use client";

import { useEffect } from "react";

/** Brings the current page's tab into view when the row of pages scrolls sideways on a phone. */
export function NavScroll() {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('.p-nav-in [aria-current="page"]');
    el?.scrollIntoView({ inline: "center", block: "nearest" });
  }, []);
  return null;
}
