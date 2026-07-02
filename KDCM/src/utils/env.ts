/**
 * Check if the app is running inside a Tauri webview.
 * Use this to conditionally render desktop-only UI (e.g., TitleBar).
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
