import type { CSSProperties } from "react";

/* ── Shimmer keyframes injected once ── */
const shimmerStyle = `
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

const shimmerBase: CSSProperties = {
  background: "linear-gradient(90deg, #e5e5e5 25%, #f0f0f0 50%, #e5e5e5 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.5s ease-in-out infinite",
  borderRadius: 6,
};

/* ── Primitives ── */

interface SkeletonRectProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function SkeletonRect({ width = "100%", height = 16, className = "" }: SkeletonRectProps) {
  return (
    <div
      className={className}
      style={{ ...shimmerBase, width, height }}
      aria-hidden="true"
    />
  );
}

/* ── Composed skeletons ── */

/** 3 stacked document rows (100% × 52px) */
export function SkeletonDocumentList() {
  return (
    <div className="flex flex-col gap-3 p-4" role="status" aria-label="Loading documents">
      <style>{shimmerStyle}</style>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg p-3"
          style={{ backgroundColor: "var(--bg-secondary, #f5f5f5)", height: 52 }}
          aria-hidden="true"
        >
          <SkeletonRect width={32} height={32} />
          <div className="flex flex-1 flex-col gap-2">
            <SkeletonRect width="60%" height={12} />
            <SkeletonRect width="35%" height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Category tree: 5 lines of varying width (60/80/45/70/55%), 16px tall */
export function SkeletonCategoryTree() {
  const widths = ["60%", "80%", "45%", "70%", "55%"];
  return (
    <div className="flex flex-col gap-3 p-4" role="status" aria-label="Loading categories">
      <style>{shimmerStyle}</style>
      {widths.map((w, i) => (
        <SkeletonRect key={i} width={w} height={16} />
      ))}
    </div>
  );
}

/** Chart placeholder: fills container, gray-100 */
export function SkeletonChart({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{
        ...shimmerBase,
        minHeight: 200,
        backgroundColor: "var(--bg-secondary, #f5f5f5)",
      }}
      role="status"
      aria-label="Loading chart"
    >
      <style>{shimmerStyle}</style>
    </div>
  );
}

/* ── Spinner ── */

interface SpinnerProps {
  size?: number;
  className?: string;
}

/**
 * 24px spinner for short operations (&lt;2s).
 * Border 2px peach-200, one segment peach-500, 800ms linear rotation.
 *
 * Usage: wrap the triggering button with a parent that tracks loading,
 * disable the button while spinning.
 */
export function Spinner({ size = 24, className = "" }: SpinnerProps) {
  return (
    <>
      <style>{`
        @keyframes spin-800 {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        className={`inline-block ${className}`}
        style={{
          width: size,
          height: size,
          border: "2px solid var(--border, #e5e5e5)",
          borderTopColor: "var(--peach, #F1D7FF)",
          borderRadius: "50%",
          animation: "spin-800 800ms linear infinite",
        }}
        role="status"
        aria-label="Loading"
      />
    </>
  );
}

export default SkeletonRect;
