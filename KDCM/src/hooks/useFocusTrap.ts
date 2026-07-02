import { useEffect, useRef } from "react";

/**
 * Focus trap for modals / dialogs.
 *
 * When the modal is open, Tab cycles only among focusable elements
 * inside the container. Shift+Tab goes backwards. Escape calls onClose.
 *
 * Usage:
 *   const ref = useFocusTrap(open, onClose);
 *   return <div ref={ref} role="dialog" aria-modal="true">...</div>;
 */
export function useFocusTrap(
  open: boolean,
  onClose: () => void,
): React.RefObject<HTMLDivElement | null> {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Remember which element was focused before the modal opened
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (!container) return;

    // Find all focusable elements inside the container
    const getFocusable = (): HTMLElement[] => {
      const selector = [
        "a[href]",
        "button:not([disabled])",
        "textarea:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        '[tabindex]:not([tabindex="-1"])',
      ].join(",");

      return Array.from(
        container.querySelectorAll<HTMLElement>(selector),
      ).filter((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden";
      });
    };

    // Focus the first focusable element (or the container itself)
    const focusables = getFocusable();
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const currentFocusables = getFocusable();
      if (currentFocusables.length === 0) {
        e.preventDefault();
        return;
      }

      const first = currentFocusables[0];
      const last = currentFocusables[currentFocusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        // Backwards: if at first, wrap to last
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Forwards: if at last, wrap to first
        if (active === last || !container.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      // Restore focus to the element that triggered the modal
      previousFocusRef.current?.focus();
    };
  }, [open, onClose]);

  return containerRef;
}

export default useFocusTrap;
