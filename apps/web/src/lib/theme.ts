// Theme preference is stored locally; the resolved theme drives data-theme on <html>.
export const THEME_STORAGE_KEY = "kiro-theme";
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = "light" | "dark";

// Unknown or missing values fall back to light, the established application theme.
export function parseThemePreference(value: unknown): ThemePreference {
  return value === "dark" || value === "system" ? value : "light";
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

// Runs before first paint (see app/layout.tsx) so a dark preference never flashes light.
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=(p==="dark"||(p==="system"&&d))?"dark":"light";}catch(e){}})();`;
