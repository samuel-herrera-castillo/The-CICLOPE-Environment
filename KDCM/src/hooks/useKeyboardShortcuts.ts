import { useEffect, useCallback } from "react";

interface ShortcutMap {
  [combo: string]: () => void;
}

/**
 * Global keyboard shortcut handler.
 *
 * Usage (in App.tsx):
 *   useKeyboardShortcuts({
 *     "Ctrl+Shift+F": () => openGlobalSearch(),
 *     "Ctrl+Z":        () => undo(),
 *     "Ctrl+Y":        () => redo(),
 *     "Ctrl+,":        () => openSettings(),
 *     "Ctrl+S":        () => createSnapshot(),
 *     "F1":            () => openHelp(),
 *     "Escape":        () => closeActiveModal(),
 *     "F11":           () => toggleFocusMode(),
 *   });
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      // Don't fire inside text inputs / contentEditable areas
      const tag = (e.target as HTMLElement).tagName;
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
        (e.target as HTMLElement).isContentEditable;

      // Allow Escape everywhere, block others inside editable fields
      if (e.key !== "Escape" && isEditable) return;

      const combo = buildCombo(e);
      const action = shortcuts[combo];
      if (action) {
        e.preventDefault();
        e.stopPropagation();
        action();
      }
    },
    [shortcuts],
  );

  useEffect(() => {
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handler]);
}

/** Build a canonical shortcut string from a keyboard event. */
function buildCombo(e: KeyboardEvent): string {
  const parts: string[] = [];

  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  // Normalize key name
  let key = e.key;
  if (key === "Control" || key === "Alt" || key === "Shift" || key === "Meta") {
    return parts.join("+");
  }

  // Map common keys
  const keyMap: Record<string, string> = {
    ",": ",",
    ".": ".",
    "/": "/",
    "\\": "\\",
    "ArrowUp": "Up",
    "ArrowDown": "Down",
    "ArrowLeft": "Left",
    "ArrowRight": "Right",
    " ": "Space",
  };

  key = keyMap[key] ?? (key.length === 1 ? key.toUpperCase() : key);
  parts.push(key);

  return parts.join("+");
}

export default useKeyboardShortcuts;
