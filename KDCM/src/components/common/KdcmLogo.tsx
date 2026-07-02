import { useUIStore } from "../../stores/uiStore";
import logoPng from "../../assets/logo.png";

interface KdcmLogoProps {
  /** Icon size in px */
  size?: number;
  /** mono = grayscale filter applied, color = full color */
  variant?: "mono" | "color";
  /** Optional extra class names */
  className?: string;
}

/**
 * KDCM peach logo — raster PNG (src/assets/logo.png).
 *
 * States:
 * - Normal:   full color or mono (grayscale via CSS filter)
 * - Loading:  pulse animation (opacity 1 → 0.5 → 1, 1.5s infinite)
 * - Error:    grayscale(100%) filter + 8px red badge (click → diagnostic modal)
 *
 * Hover:      scale(1) → scale(1.08) in 150ms ease-out
 */
export function KdcmLogo({ size = 20, variant = "color", className = "" }: KdcmLogoProps) {
  const appLoading = useUIStore((s) => s.appLoading);
  const error = useUIStore((s) => s.error);
  const openDiagnostic = useUIStore((s) => s.openDiagnostic);

  const hasError = error !== null;
  const isMono = variant === "mono";

  const handleClick = () => {
    if (hasError) openDiagnostic();
  };

  return (
    <div
      className={`kdcm-logo logo-hover relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      onClick={handleClick}
      title={hasError ? "System error — click for diagnostics" : "KDCM"}
      role={hasError ? "button" : undefined}
      tabIndex={hasError ? 0 : undefined}
      onKeyDown={
        hasError
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") openDiagnostic();
            }
          : undefined
      }
    >
      <img
        src={logoPng}
        alt="KDCM logo"
        width={size}
        height={size}
        className={`block ${appLoading ? "animate-pulse-logo" : ""}`}
        style={{
          filter: hasError
            ? "grayscale(100%)"
            : isMono
              ? "grayscale(1)"
              : undefined,
        }}
        draggable={false}
      />

      {/* ── Red error badge ── */}
      {hasError && (
        <span
          className="absolute top-0 right-0 block rounded-full bg-red-500 ring-1 ring-white"
          style={{ width: 8, height: 8 }}
          aria-label="Error indicator"
        />
      )}
    </div>
  );
}

export default KdcmLogo;
