/**
 * Theme constants for programmatic use (charts, canvas, etc.).
 *
 * Colors reference the CSS variables defined in globals.css.
 * Use these when you need theme values in JavaScript/TypeScript.
 */

export type ThemeVariant = "light" | "dark";

export interface ThemeColors {
  bg: string;
  text: string;
  textSecondary: string;
  border: string;
  peach: string;
  chart: string[];
}

const LIGHT: ThemeColors = {
  bg: "#FFFFFF",
  text: "#1A1A1A",
  textSecondary: "#6B6B6B",
  border: "#E5E5E5",
  peach: "#F1D7FF",
  chart: [
    "#F1D7FF", "#2196F3", "#4CAF50", "#D4A8E0", "#9C27B0",
    "#00BCD4", "#F44336", "#3F51B5", "#009688", "#FF5722",
  ],
};

const DARK: ThemeColors = {
  bg: "#1E2A3A",
  text: "#E2E8F0",
  textSecondary: "#94A3B8",
  border: "#2D3F55",
  peach: "#F1D7FF",
  chart: [
    "#F1D7FF", "#64B5F6", "#81C784", "#D4A8E0", "#BA68C8",
    "#4DD0E1", "#E57373", "#7986CB", "#80CBC4", "#FF8A65",
  ],
};

/**
 * Resolve the effective theme from the data-theme attribute.
 */
export function getTheme(): ThemeColors {
  if (typeof document === "undefined") return LIGHT;
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? DARK : LIGHT;
}

/** Reactively observe theme changes */
export function onThemeChange(cb: (colors: ThemeColors) => void): () => void {
  const observer = new MutationObserver(() => {
    cb(getTheme());
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

/** Get a CSS variable value at runtime */
export function cssVar(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
