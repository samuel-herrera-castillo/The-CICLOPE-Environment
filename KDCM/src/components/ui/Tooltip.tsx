import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  /** Tooltip content */
  content: string;
  /** Optional keyboard shortcut chip (e.g. "Shift+Ctrl+V") */
  shortcut?: string;
  /** Preferred position — auto-flips if out of viewport */
  position?: "top" | "bottom";
  /** Trigger element */
  children: ReactNode;
  /** Disable the tooltip entirely */
  disabled?: boolean;
}

/**
 * Tooltip with delayed show/hide and automatic viewport fitting.
 *
 * - Show delay: 600ms
 * - Hide delay: 100ms
 * - Prefers "top" position, auto-flips to "bottom" if insufficient space
 * - Renders via portal to avoid overflow clipping
 *
 * Usage:
 *   <Tooltip content="Codificación in vivo" shortcut="Shift+Ctrl+V">
 *     <button>…</button>
 *   </Tooltip>
 */
export function Tooltip({
  content,
  shortcut,
  position = "top",
  children,
  disabled = false,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [flipped, setFlipped] = useState(false);

  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  };

  const show = () => {
    if (disabled) return;
    clearTimers();
    showTimer.current = setTimeout(() => setVisible(true), 600);
  };

  const hide = () => {
    clearTimers();
    hideTimer.current = setTimeout(() => setVisible(false), 100);
  };

  // Cleanup on unmount
  useEffect(() => clearTimers, []);

  // Position calculation
  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tipRect = tooltipRef.current.getBoundingClientRect();
    const gap = 8;

    const preferred = position ?? "top";
    let top: number;
    let actualFlipped = false;

    if (preferred === "top") {
      top = triggerRect.top - tipRect.height - gap;
      if (top < 8) {
        // Flip to bottom
        top = triggerRect.bottom + gap;
        actualFlipped = true;
      }
    } else {
      top = triggerRect.bottom + gap;
      if (top + tipRect.height > window.innerHeight - 8) {
        // Flip to top
        top = triggerRect.top - tipRect.height - gap;
        actualFlipped = true;
      }
    }

    // Center horizontally, clamp to viewport
    let left = triggerRect.left + triggerRect.width / 2 - tipRect.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));

    setCoords({ top, left });
    setFlipped(actualFlipped);
  }, [visible, position]);

  const tooltipPortal = visible && (
    <div
      ref={tooltipRef}
      className="pointer-events-none fixed z-[200]"
      style={{ top: coords.top, left: coords.left }}
    >
      {/* Tooltip body */}
      <div
        className="relative flex items-center gap-2 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs text-white shadow-md"
        style={{ fontFamily: "Inter, sans-serif", fontSize: 12 }}
      >
        <span>{content}</span>

        {/* Shortcut chip */}
        {shortcut && (
          <kbd
            className="rounded border px-1.5 py-px text-[11px]"
            style={{
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              backgroundColor: "rgba(255,255,255,0.12)",
              borderColor: "rgba(255,255,255,0.2)",
              whiteSpace: "nowrap",
            }}
          >
            {shortcut}
          </kbd>
        )}

        {/* Arrow */}
        <div
          className="absolute left-1/2 h-0 w-0 -translate-x-1/2 border-4 border-transparent"
          style={{
            [flipped ? "top" : "bottom"]: "-8px",
            [flipped ? "borderBottomColor" : "borderTopColor"]: "#111827",
          }}
        />
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex"
      >
        {children}
      </div>
      {createPortal(tooltipPortal, document.body)}
    </>
  );
}

export default Tooltip;
