/**
 * The display setting, per device (a cookie, so the server paints the right colours from the first
 * frame, no flash): « Sombre » is the CLHUB as it always was and stays the default, « Clair » the
 * same club in daylight, « Automatique » follows the phone. See globals.css for the colours.
 */
export const THEME_COOKIE = "clhub_theme";
export type Theme = "dark" | "light" | "auto";

export function parseTheme(value: string | undefined | null): Theme {
  return value === "light" || value === "auto" ? value : "dark";
}

/** The class on <html> for a setting. */
export function themeClass(theme: Theme): string {
  return theme === "light" ? "light" : theme === "auto" ? "theme-auto" : "dark";
}
