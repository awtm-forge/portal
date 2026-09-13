import { describe, expect, it } from "vitest";
import { check, PAIRS, ratio, tokenFile, tokensFrom } from "../scripts/contrast";

/**
 * The palette is a promise about readability, so it is tested like any other
 * rule. Both themes, every pairing the portal renders, against WCAG AA.
 */
describe("the palette", () => {
  const css = tokenFile();

  it("passes AA on every pairing, in both themes", () => {
    const failures = check(css).filter((r) => !r.ok);
    const said = failures.map((f) => `${f.theme}: ${f.name} is ${f.ratio}:1, needs ${f.min} (${f.fg} on ${f.bg})`);
    expect(said, said.join("\n")).toEqual([]);
  });

  it("defines both themes from the same set of roles", () => {
    const dark = tokensFrom(css, "dark");
    const light = tokensFrom(css, "light");
    // A light value with no dark counterpart is a token only one theme knows
    // about, which is how a theme ends up with a colour nothing checks.
    const orphans = Object.keys(light).filter((k) => !(k in dark));
    expect(orphans, `light-only tokens: ${orphans.join(", ")}`).toEqual([]);
  });

  it("keeps one accent hue, so nothing else creeps in", () => {
    // Every accent token is the same hue family in both themes. A second
    // accent colour is a design decision, not a value someone slips into a
    // stylesheet, so this fails if one appears.
    for (const theme of ["dark", "light"] as const) {
      const t = tokensFrom(css, theme);
      for (const name of ["accent", "accent-fill"]) {
        const hex = t[name];
        if (!hex?.startsWith("#")) continue;
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        expect(r, `${theme} --${name} is not a warm orange`).toBeGreaterThan(g);
        expect(g, `${theme} --${name} is not a warm orange`).toBeGreaterThan(b);
      }
    }
  });

  it("measures the way WCAG does", () => {
    expect(ratio("#ffffff", "#000000")).toBeCloseTo(21, 1);
    expect(ratio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(PAIRS.length).toBeGreaterThan(10);
  });
});
