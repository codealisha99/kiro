"use client";

import { useCallback, useEffect, useState } from "react";
import {
  parseThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

function readStoredPreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "light";
  }
}

// Reads the stored choice during the first client render so no frame shows the wrong theme.
// The inline script in app/layout.tsx has already applied the same value before paint.
export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    typeof window === "undefined" ? "light" : readStoredPreference(),
  );
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const next = resolveTheme(preference, media.matches);
      document.documentElement.dataset.theme = next;
      setResolved(next);
    };
    apply();
    if (preference !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* Storage can be unavailable (private mode); the choice still applies for this visit. */
    }
    setPreferenceState(next);
  }, []);

  return { preference, resolved, setPreference };
}
