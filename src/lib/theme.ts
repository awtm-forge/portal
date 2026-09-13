/**
 * Light or dark, in the client portal only (13 Sep).
 *
 * The choice is a cookie rather than localStorage so the server can read it,
 * and the attribute it drives is set by a script that runs while the document
 * is still parsing, so a person who chose light never sees a dark flash first.
 *
 * "system" is the default and is resolved in the browser, which is the only
 * place that knows. The admin and the marketing site set nothing, so they read
 * the :root block and stay dark.
 *
 * The cookie is not httpOnly on purpose: it holds one of three words, never
 * anything private, and the toggle has to write it without a round trip.
 */
export const THEME_COOKIE = "awtm_theme";

export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export function isThemeChoice(value: string | undefined | null): value is ThemeChoice {
  return value === "system" || value === "light" || value === "dark";
}

/** A year. Long enough that a client never has to choose twice. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Runs before the page paints. Reads the cookie, resolves "system" against the
 * device, and stamps the result on <html>, which is where the light token
 * block is keyed. Wrapped in try so a browser with cookies off still renders,
 * in the dark theme, rather than not at all.
 */
/** The choice this browser holds, or "system". */
export function readThemeCookie(): ThemeChoice {
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  const saved = match ? decodeURIComponent(match[1]) : "system";
  return isThemeChoice(saved) ? saved : "system";
}

/** Remember it, and stamp the resolved theme on the document. */
export function rememberTheme(choice: ThemeChoice): void {
  document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
  applyTheme(choice);
}

/** Resolve "system" against the device and put the answer on <html>. */
export function applyTheme(choice: ThemeChoice): void {
  const light = choice === "light" || (choice !== "dark" && window.matchMedia("(prefers-color-scheme: light)").matches);
  document.documentElement.setAttribute("data-theme", light ? "light" : "dark");
}

export const THEME_SCRIPT = `(function(){try{
var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);
var c=m?decodeURIComponent(m[1]):"system";
var light=c==="light"||(c!=="dark"&&window.matchMedia("(prefers-color-scheme: light)").matches);
document.documentElement.setAttribute("data-theme",light?"light":"dark");
}catch(e){}})();`;
