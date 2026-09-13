/**
 * Light or dark, in both portals (13 Sep).
 *
 * Dark is the default and the brand. A person who wants paper says so, and
 * the choice sticks; nobody is handed a theme because of what their phone
 * happens to be set to, which is why there is no "follow the device" here
 * (Ayush, 13 Sep).
 *
 * The choice is a cookie rather than localStorage so the server can read it,
 * and the attribute it drives is set by a script that runs while the document
 * is still parsing, so a person who chose light never sees a dark flash first.
 *
 * The cookie is not httpOnly on purpose: it holds one of two words, never
 * anything private, and the toggle has to write it without a round trip.
 */
export const THEME_COOKIE = "awtm_theme";

export const THEME_CHOICES = ["dark", "light"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export const DEFAULT_THEME: ThemeChoice = "dark";

export function isThemeChoice(value: string | undefined | null): value is ThemeChoice {
  return value === "light" || value === "dark";
}

/** A year. Long enough that a person never has to choose twice. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The choice this browser holds, or dark. */
export function readThemeCookie(): ThemeChoice {
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  const saved = match ? decodeURIComponent(match[1]) : "";
  return isThemeChoice(saved) ? saved : DEFAULT_THEME;
}

/** Remember it, and stamp it on the document. */
export function rememberTheme(choice: ThemeChoice): void {
  document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
  applyTheme(choice);
}

export function applyTheme(choice: ThemeChoice): void {
  document.documentElement.setAttribute("data-theme", choice);
}

/**
 * Runs before the page paints. Reads the cookie and stamps the answer on
 * <html>, which is where the light token block is keyed. Wrapped in try so a
 * browser with cookies off still renders, in the dark theme, rather than not
 * at all.
 */
export const THEME_SCRIPT = `(function(){try{
var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);
document.documentElement.setAttribute("data-theme",m&&decodeURIComponent(m[1])==="light"?"light":"dark");
}catch(e){}})();`;
