import { useEffect, useCallback, useSyncExternalStore } from "react";
import { useUIStore } from "../stores/uiStore";

type Theme = "system" | "light" | "dark";
type EffectiveTheme = "light" | "dark";

const STORAGE_KEY = "kdcm-theme";

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage unavailable (private browsing, SSR, etc.)
  }
  return "system";
}

function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

function getSystemTheme(): EffectiveTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(theme: Theme): EffectiveTheme {
  return theme === "system" ? getSystemTheme() : theme;
}

/**
 * Subscribe to OS-level theme changes.
 * Returns an unsubscribe function.
 */
function subscribeSystemTheme(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

/** Current system theme snapshots (for useSyncExternalStore). */
function getSystemSnapshot(): EffectiveTheme {
  return getSystemTheme();
}

/**
 * Theme hook.
 *
 * Reads the stored preference, resolves "system" against the OS,
 * applies data-theme to <html>, and listens for OS changes in real time.
 *
 * Returns:
 *  - theme:        the stored preference ("system" | "light" | "dark")
 *  - effectiveTheme: what's actually applied ("light" | "dark")
 *  - setTheme:     persist + apply a new preference
 */
export function useTheme() {
  const storeTheme = useUIStore((s) => s.theme);
  const storeSetTheme = useUIStore((s) => s.setTheme);

  // Initialize from localStorage on first render
  useEffect(() => {
    const stored = getStoredTheme();
    if (stored !== storeTheme) {
      storeSetTheme(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const systemTheme = useSyncExternalStore(
    subscribeSystemTheme,
    getSystemSnapshot,
    getSystemSnapshot,
  );

  const effectiveTheme: EffectiveTheme =
    storeTheme === "system" ? systemTheme : storeTheme;

  // Apply data-theme attribute to <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", effectiveTheme);
  }, [effectiveTheme]);

  const setTheme = useCallback(
    (next: Theme) => {
      storeSetTheme(next);
      setStoredTheme(next);
    },
    [storeSetTheme],
  );

  return { theme: storeTheme, effectiveTheme, setTheme } as const;
}

export type { Theme, EffectiveTheme };
export { resolveTheme, getStoredTheme, setStoredTheme, getSystemTheme };
export default useTheme;
