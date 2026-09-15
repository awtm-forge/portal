/**
 * Every colour pairing the portal puts text on, checked against WCAG AA in
 * both themes, read from the one token file rather than from a copy of it.
 *
 * The token file marks its two blocks with `/* tokens: dark *\/` and
 * `/* tokens: light *\/`. This reads the declarations that follow each marker,
 * resolves the var() aliases, and measures. tests/contrast.test.ts runs it, so
 * a palette change that breaks a pairing fails the suite rather than reaching
 * a client's screen.
 *
 * AA is 4.5:1 for body text and 3:1 for large text and for anything that is
 * not text but still carries meaning: a focus ring, the progress rail's rings,
 * the line between stages. A disabled control is exempt (WCAG 1.4.3), which is
 * why --off is not in this list.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Theme = "dark" | "light";

export type Pair = {
  /** What this pairing is, in words, so a failure names the screen it breaks. */
  name: string;
  fg: string;
  bg: string;
  /** 4.5 for body text, 3 for large text and for meaningful non-text. */
  min: number;
};

/** Every pairing the client portal and the admin actually render. */
export const PAIRS: Pair[] = [
  // Body and headings, on each of the three grounds.
  { name: "body on the page", fg: "ink", bg: "ground", min: 4.5 },
  { name: "body on a card", fg: "ink", bg: "surface", min: 4.5 },
  { name: "body on a raised card", fg: "ink", bg: "surface-raised", min: 4.5 },
  // Metadata and labels. One grey, not two, so a caption is as readable as a
  // sentence (13 Sep: the second grey was the low-contrast one).
  { name: "metadata on the page", fg: "ink-muted", bg: "ground", min: 4.5 },
  { name: "metadata on a card", fg: "ink-muted", bg: "surface", min: 4.5 },
  { name: "metadata on a raised card", fg: "ink-muted", bg: "surface-raised", min: 4.5 },
  // The floating surface is the menu and the notification tray. It was not
  // checked until a control went on it: sign out is a thing a person has to be
  // able to read, not a caption they can skip (15 Sep).
  { name: "body on a floating panel", fg: "ink", bg: "surface-float", min: 4.5 },
  { name: "metadata on a floating panel", fg: "ink-muted", bg: "surface-float", min: 4.5 },
  // The accent as text: links, the action-needed chip, the current stage.
  { name: "accent text on the page", fg: "accent", bg: "ground", min: 4.5 },
  { name: "accent text on a card", fg: "accent", bg: "surface", min: 4.5 },
  { name: "accent text on a raised card", fg: "accent", bg: "surface-raised", min: 4.5 },
  { name: "accent text on its own soft ground", fg: "accent", bg: "accent-soft", min: 4.5 },
  // The filled button, which is the one loud thing on a client page.
  { name: "button label on the accent fill", fg: "accent-ink", bg: "accent-fill", min: 4.5 },
  // The two state colours. Used for a chip and its words, never alone.
  { name: "done state on a card", fg: "success", bg: "surface", min: 4.5 },
  { name: "done state on a raised card", fg: "success", bg: "surface-raised", min: 4.5 },
  { name: "error text on a card", fg: "danger", bg: "surface", min: 4.5 },
  { name: "error text on the page", fg: "danger", bg: "ground", min: 4.5 },
  // Not text, but it carries the meaning: the rail's rings and its line, and
  // the ring that shows keyboard focus.
  { name: "the accent fill against the page", fg: "accent-fill", bg: "ground", min: 3 },
  { name: "the accent fill against a card", fg: "accent-fill", bg: "surface", min: 3 },
  { name: "an upcoming stage ring on a card", fg: "ink-muted", bg: "surface", min: 3 },
  { name: "the focus ring on the page", fg: "accent", bg: "ground", min: 3 },
];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function expand(hex: string): [number, number, number] {
  const h = hex.slice(1);
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = expand(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function ratio(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The declarations that follow a `tokens:` marker, with var() aliases resolved
 * against the dark block, which is the base every theme overrides.
 */
export function tokensFrom(css: string, theme: Theme): Record<string, string> {
  const marker = `/* tokens: ${theme} */`;
  const at = css.indexOf(marker);
  if (at === -1) throw new Error(`globals.css has no "${marker}" block`);
  const end = css.indexOf("}", at);
  const block = css.slice(at + marker.length, end);
  const out: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = /^\s*--([a-z0-9-]+)\s*:\s*([^;]+);/i.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

/** The colour a token resolves to in a theme, following one level of alias. */
export function resolve(name: string, theme: Record<string, string>, base: Record<string, string>): string | null {
  const raw = theme[name] ?? base[name];
  if (!raw) return null;
  const alias = /^var\(\s*--([a-z0-9-]+)\s*\)$/i.exec(raw);
  if (alias) return resolve(alias[1], theme, base);
  return HEX.test(raw) ? raw : null;
}

export type Result = { theme: Theme; name: string; fg: string; bg: string; ratio: number; min: number; ok: boolean };

export function check(css: string): Result[] {
  const dark = tokensFrom(css, "dark");
  const out: Result[] = [];
  for (const theme of ["dark", "light"] as Theme[]) {
    const values = theme === "dark" ? dark : tokensFrom(css, "light");
    for (const pair of PAIRS) {
      const fg = resolve(pair.fg, values, dark);
      const bg = resolve(pair.bg, values, dark);
      if (!fg || !bg) throw new Error(`${theme}: ${pair.fg} or ${pair.bg} is not a colour`);
      const r = Math.round(ratio(fg, bg) * 100) / 100;
      out.push({ theme, name: pair.name, fg, bg, ratio: r, min: pair.min, ok: r >= pair.min });
    }
  }
  return out;
}

export function tokenFile(): string {
  return readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
}

if (process.argv[1]?.endsWith("contrast.ts")) {
  const results = check(tokenFile());
  for (const theme of ["dark", "light"] as Theme[]) {
    console.log(`\n${theme}`);
    for (const r of results.filter((x) => x.theme === theme)) {
      console.log(`  ${r.ok ? "ok  " : "FAIL"} ${String(r.ratio).padStart(6)}:1  needs ${r.min}  ${r.name}  ${r.fg} on ${r.bg}`);
    }
  }
  const bad = results.filter((r) => !r.ok);
  console.log(`\n${results.length - bad.length} of ${results.length} pass`);
  process.exit(bad.length === 0 ? 0 : 1);
}
