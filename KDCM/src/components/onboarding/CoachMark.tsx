import { useState, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useOnboardingStore } from "../../stores/onboardingStore";

interface CoachMarkProps {
  /** Unique ID for this coach mark (stored as kdcm_seen_[id]) */
  id: string;
  /** The target element this coach mark highlights */
  children: ReactNode;
  /** Tooltip text shown next to the pulsing dot */
  label: string;
  /** Disable the coach mark entirely (e.g. onboarding not done yet) */
  disabled?: boolean;
}

/**
 * Coach mark — a pulsing dot (animated ping) over a UI element shown
 * the first time the panel/feature is opened. Clicking the target
 * dismisses the mark and saves the seen state to localStorage.
 *
 * Usage:
 *   <CoachMark id="left-panel" label="Your documents live here">
 *     <Sidebar />
 *   </CoachMark>
 */
export function CoachMark({ id, children, label, disabled = false }: CoachMarkProps) {
  const hasSeen = useOnboardingStore((s) => s.hasSeen(id));
  const markSeen = useOnboardingStore((s) => s.markSeen);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const isShown = visible && !hasSeen && !disabled;

  // Delay appearance so layout has settled
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(t);
  }, []);

  // Calculate position
  useEffect(() => {
    if (!isShown || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPos({
      top: rect.top + rect.height / 2 - 10,
      left: rect.left + rect.width / 2 - 10,
    });
  }, [isShown]);

  const dismiss = () => {
    markSeen(id);
  };

  return (
    <div ref={containerRef} className="relative inline-flex" onClick={dismiss}>
      {children}

      {isShown && createPortal(
        <>
          {/* Pulsing dot */}
          <div
            className="pointer-events-none fixed z-[250]"
            style={{ top: pos.top, left: pos.left }}
          >
            {/* Outer ping ring */}
            <span className="absolute inset-0 animate-ping rounded-full bg-peach-500 opacity-40" />
            {/* Inner solid dot */}
            <span className="absolute inset-0 rounded-full bg-peach-500" style={{ width: 12, height: 12, margin: 4 }} />
          </div>

          {/* Tooltip label */}
          <div
            className="pointer-events-none fixed z-[250] rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg"
            style={{
              top: pos.top - 48,
              left: Math.max(8, pos.left - 60),
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              maxWidth: 180,
            }}
          >
            {label}
            <div
              className="absolute left-1/2 h-0 w-0 -translate-x-1/2 border-4 border-transparent"
              style={{ bottom: "-8px", borderTopColor: "#111827" }}
            />
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}

export default CoachMark;
