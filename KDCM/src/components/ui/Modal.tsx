import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useFocusTrap } from "../../hooks/useFocusTrap";

/* ── Size map ── */
const SIZE_MAP = {
  sm:   "400px",
  md:   "560px",
  lg:   "720px",
  xl:   "900px",
  full: "95vw",
} as const;

type ModalSize = keyof typeof SIZE_MAP;

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Prevent closing via overlay click / Escape when false (default true) */
  allowClose?: boolean;
  size?: ModalSize;
  /** Header title */
  title?: string;
  /** Body content */
  children: ReactNode;
  /** Footer content (action buttons, etc.) */
  footer?: ReactNode;
}

/**
 * Base modal component.
 *
 * Features:
 * - Renders via React portal (avoids z-index stacking issues)
 * - Backdrop: rgba(0,0,0,0.5) + backdrop-filter blur(4px)
 * - Enter animation: scale(0.95) → 1 + opacity 0 → 1, 200ms ease-out
 * - Exit animation:  scale(1) → 0.95 + opacity 0, 150ms ease-in
 * - Focus trap: Tab cycles inside, Escape closes
 * - Body scroll lock while open
 * - Sizes: sm | md | lg | xl | full
 *
 * Usage:
 *   <Modal open={show} onClose={() => setShow(false)} title="Settings">
 *     <p>Content here</p>
 *   </Modal>
 */
export function Modal({
  open,
  onClose,
  allowClose = true,
  size = "md",
  title,
  children,
  footer,
}: ModalProps) {
  const [visible, setVisible] = useState(false);   // controls mount
  const [anim, setAnim] = useState<"in" | "out" | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  // ── Focus trap ──
  const trapRef = useFocusTrap(open, allowClose ? onClose : () => {});

  // ── Body scroll lock ──
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  // ── Mount / unmount with animation ──
  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => setAnim("in"));
    } else {
      setAnim("out");
      const timer = setTimeout(() => setVisible(false), 150);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // ── Auto-focus first interactive element ──
  useEffect(() => {
    if (!anim || anim !== "in" || !panelRef.current) return;
    const el = panelRef.current.querySelector<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    el?.focus();
  }, [anim]);

  if (!visible) return null;

  const width = SIZE_MAP[size];
  const isFull = size === "full";

  const portal = (
    <div
      ref={trapRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        animation: anim === "in"
          ? "modal-overlay-in 200ms ease-out forwards"
          : "modal-overlay-out 150ms ease-in forwards",
      }}
      onClick={(e) => {
        if (allowClose && e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* ── Panel ── */}
      <div
        ref={panelRef}
        className="flex max-h-[90vh] flex-col overflow-hidden rounded-xl shadow-2xl"
        style={{
          width: isFull ? "95vw" : width,
          maxWidth: isFull ? "95vw" : "calc(100vw - 48px)",
          maxHeight: isFull ? "95vh" : undefined,
          backgroundColor: "var(--bg-panel, #fff)",
          color: "var(--text-primary, #1a1a1a)",
          animation: anim === "in"
            ? "modal-panel-in 200ms ease-out forwards"
            : "modal-panel-out 150ms ease-in forwards",
        }}
      >
        {/* ── Header ── */}
        {title && (
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: "1px solid var(--border, #e5e5e5)" }}
          >
            <h2 className="text-base font-semibold">{title}</h2>
            {allowClose && (
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded opacity-50 hover:opacity-100 min-touch"
                aria-label="Close"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {/* ── Footer ── */}
        {footer && (
          <div
            className="flex items-center justify-end gap-3 px-6 py-4"
            style={{ borderTop: "1px solid var(--border, #e5e5e5)" }}
          >
            {footer}
          </div>
        )}
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes modal-overlay-in  { from { opacity:0; } to { opacity:1; } }
        @keyframes modal-overlay-out { from { opacity:1; } to { opacity:0; } }
        @keyframes modal-panel-in    { from { transform:scale(0.95); opacity:0; } to { transform:scale(1); opacity:1; } }
        @keyframes modal-panel-out   { from { transform:scale(1);    opacity:1; } to { transform:scale(0.95); opacity:0; } }
      `}</style>
    </div>
  );

  return createPortal(portal, document.body);
}

/* ── Prebuilt button helpers (use inside footer) ── */

interface ModalButtonProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function ModalPrimaryButton({ children, onClick, disabled, className = "" }: ModalButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md bg-peach-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-peach-700 disabled:opacity-50 min-touch ${className}`}
    >
      {children}
    </button>
  );
}

export function ModalSecondaryButton({ children, onClick, disabled, className = "" }: ModalButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50 disabled:opacity-50 min-touch ${className}`}
      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
    >
      {children}
    </button>
  );
}

export function ModalDangerButton({ children, onClick, disabled, className = "" }: ModalButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md bg-[#F44336] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#D32F2F] disabled:opacity-50 min-touch ${className}`}
    >
      {children}
    </button>
  );
}

export default Modal;
