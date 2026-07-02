import { useEffect, useRef, useState } from "react";
import { CheckCircle, AlertTriangle, XCircle, Info, X, type LucideIcon } from "lucide-react";
import type { Toast as ToastData } from "../../stores/toastStore";
import { useToastStore } from "../../stores/toastStore";

/* ── Type config ── */
const TYPE_MAP: Record<
  ToastData["type"],
  { icon: LucideIcon; bg: string; border: string; iconColor: string }
> = {
  success: { icon: CheckCircle, bg: "#E8F5E9", border: "#4CAF50", iconColor: "#2E7D32" },
  warning: { icon: AlertTriangle, bg: "rgba(241, 215, 255, 0.5)", border: "#F1D7FF", iconColor: "#C4A0D4" },
  error:   { icon: XCircle,       bg: "#FFEBEE", border: "#F44336", iconColor: "#C62828" },
  info:    { icon: Info,          bg: "#E3F2FD", border: "#2196F3", iconColor: "#1565C0" },
};

interface ToastItemProps {
  toast: ToastData;
}

/**
 * A single toast notification.
 *
 * Animation phases:
 *  - Enter:  translateX(120%) → 0, opacity 0 → 1, 250ms
 *  - Exit:   translateX(120%), opacity 0, 200ms
 *
 * Progress bar runs for `toast.duration` ms (not rendered for error toasts).
 */
export function ToastItem({ toast }: ToastItemProps) {
  const remove = useToastStore((s) => s.removeToast);
  const [exiting, setExiting] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const cfg = TYPE_MAP[toast.type];
  const Icon = cfg.icon;

  // ── Trigger exit animation, then remove from store ──
  const dismiss = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => remove(toast.id), 200);
  };

  // ── Progress bar animation ──
  useEffect(() => {
    if (toast.duration === 0) return;
    const el = progressRef.current;
    if (!el) return;

    // Force layout, then animate width: 100% → 0% over duration
    el.style.transition = "none";
    el.style.width = "100%";
    void el.offsetWidth; // reflow
    el.style.transition = `width ${toast.duration}ms linear`;
    el.style.width = "0%";
  }, [toast.duration]);

  return (
    <div
      role="alert"
      className="relative overflow-hidden"
      style={{
        width: 320,
        backgroundColor: cfg.bg,
        borderLeft: `4px solid ${cfg.border}`,
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
        marginBottom: 10,
        animation: exiting
          ? "toast-exit 200ms ease-in forwards"
          : "toast-enter 250ms ease-out",
      }}
      onMouseEnter={() => {
        if (progressRef.current && toast.duration > 0) {
          progressRef.current.style.animationPlayState = "paused";
        }
      }}
      onMouseLeave={() => {
        if (progressRef.current && toast.duration > 0) {
          progressRef.current.style.animationPlayState = "running";
        }
      }}
    >
      {/* ── Body ── */}
      <div className="flex items-start gap-3 p-3 pr-8">
        <Icon size={18} color={cfg.iconColor} style={{ flexShrink: 0, marginTop: 1 }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: "#212121" }}>
            {toast.title}
          </p>
          {toast.message && (
            <p className="mt-0.5 text-xs opacity-75" style={{ color: "#424242" }}>
              {toast.message}
            </p>
          )}
        </div>
      </div>

      {/* ── Close button ── */}
      <button
        onClick={dismiss}
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded opacity-50 hover:opacity-100 min-touch"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>

      {/* ── Progress bar (auto-dismiss types only) ── */}
      {toast.duration > 0 && (
        <div
          ref={progressRef}
          className="h-[3px]"
          style={{ backgroundColor: cfg.border, width: "100%" }}
        />
      )}
    </div>
  );
}

/**
 * Renders all active toasts, stacked in the bottom-right corner.
 */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <>
      {/* Inline keyframes — scoped to this component tree */}
      <style>{`
        @keyframes toast-enter {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes toast-exit {
          from { transform: translateX(0);    opacity: 1; }
          to   { transform: translateX(120%); opacity: 0; }
        }
      `}</style>

      <div
        className="no-print fixed z-[100] flex flex-col items-end"
        style={{ right: 24, bottom: 24 }}
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </div>
    </>
  );
}

export default ToastContainer;
