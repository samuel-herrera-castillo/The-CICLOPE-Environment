import { type ReactNode, useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLayoutStore } from "../../stores/layoutStore";
import { ErrorBoundary } from "../error/ErrorBoundary";
import { Navbar } from "./Navbar";
import { SecondaryBar } from "./SecondaryBar";
import { FilterIndicator } from "./FilterIndicator";
import { StatusBar } from "./StatusBar";

interface AppShellProps {
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
}

/* ── Panel constraints ── */
const MIN_LEFT  = 180;
const MAX_LEFT  = 420;
const MIN_RIGHT = 200;
const MAX_RIGHT = 480;
const RESIZER_W = 4;

/**
 * Three-panel application shell with advanced resize behavior.
 *
 * Features:
 * - 4px resize dividers with peach-200 hover + ew-resize cursor
 * - Double-click divider → collapse/expand panel (200ms animation)
 * - Collapse toggle buttons [◀] [▶] on panel edges
 * - Min/max width constraints (left: 180-420, right: 200-480)
 * - Auto-collapse both panels on screens < 900px
 * - Filter indicator bar (4px, only when filters active)
 */
export function AppShell({ leftPanel, centerPanel, rightPanel }: AppShellProps) {
  const panelIzqAncho = useLayoutStore((s) => s.panelIzqAncho);
  const panelDerAncho = useLayoutStore((s) => s.panelDerAncho);
  const izqColapsado = useLayoutStore((s) => s.panelIzqColapsado);
  const derColapsado = useLayoutStore((s) => s.panelDerColapsado);
  const setPanelIzqAncho = useLayoutStore((s) => s.setPanelIzqAncho);
  const setPanelDerAncho = useLayoutStore((s) => s.setPanelDerAncho);
  const togglePanelIzq = useLayoutStore((s) => s.togglePanelIzq);
  const togglePanelDer = useLayoutStore((s) => s.togglePanelDer);

  const [isSmall, setIsSmall] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 900 : false,
  );

  // ── Responsive: auto-collapse panels on small screens ──
  useEffect(() => {
    const check = () => setIsSmall(window.innerWidth < 900);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Filter state handled by FilterIndicator via filterStore ──

  // ── Resize logic ──

  const createResizeHandler = useCallback(
    (side: "left" | "right") => (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = side === "left" ? panelIzqAncho : panelDerAncho;
      const setter = side === "left" ? setPanelIzqAncho : setPanelDerAncho;
      const min = side === "left" ? MIN_LEFT : MIN_RIGHT;
      const max = side === "left" ? MAX_LEFT : MAX_RIGHT;

      const onMove = (ev: MouseEvent) => {
        const delta = side === "left" ? ev.clientX - startX : startX - ev.clientX;
        setter(Math.max(min, Math.min(max, startW + delta)));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [panelIzqAncho, panelDerAncho, setPanelIzqAncho, setPanelDerAncho],
  );

  // ── Double-click to collapse ──
  const handleDoubleClick = useCallback(
    (side: "left" | "right") => () => {
      if (side === "left") togglePanelIzq();
      else togglePanelDer();
    },
    [togglePanelIzq, togglePanelDer],
  );

  const collapsedLeft  = izqColapsado || isSmall;
  const collapsedRight = derColapsado || isSmall;

  // Keep a 20px strip when collapsed so the toggle button remains visible
  const COLLAPSED_W = 20;
  const leftW  = collapsedLeft ? COLLAPSED_W : panelIzqAncho;
  const rightW = collapsedRight ? COLLAPSED_W : panelDerAncho;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* ── Navbar + filter indicator ── */}
      <Navbar />
      <SecondaryBar />
      <FilterIndicator />

      {/* ── Panel area ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <ErrorBoundary panel="left">
          <div
            className="relative flex-shrink-0"
            style={{
              width: leftW,
              transition: "width 200ms ease-out",
            }}
          >
            {/* Collapse toggle button */}
            <button
              onClick={togglePanelIzq}
              className="absolute right-0 top-1/2 z-10 flex h-8 w-5 -translate-y-1/2 items-center justify-center rounded-l-md opacity-30 hover:opacity-80"
              style={{ backgroundColor: "var(--border)", color: "var(--text-primary)" }}
              aria-label={collapsedLeft ? "Expand left panel" : "Collapse left panel"}
              title={collapsedLeft ? "Expand" : "Collapse"}
            >
              {collapsedLeft ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>
            <div className="overflow-hidden" style={{ width: collapsedLeft ? 0 : "100%" }}>
              {!collapsedLeft && leftPanel}
            </div>
          </div>
        </ErrorBoundary>

        {/* ── Left resizer ── */}
        {!collapsedLeft && (
          <div
            className="flex-shrink-0 cursor-ew-resize transition-colors hover:bg-peach-200 active:bg-peach-300"
            style={{ width: RESIZER_W, backgroundColor: "var(--border)" }}
            onMouseDown={createResizeHandler("left")}
            onDoubleClick={handleDoubleClick("left")}
            title="Double-click to collapse"
          />
        )}

        {/* ── Center panel ── */}
        <ErrorBoundary panel="center">
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-auto">
              {centerPanel}
            </div>
          </div>
        </ErrorBoundary>

        {/* ── Right resizer ── */}
        {!collapsedRight && (
          <div
            className="flex-shrink-0 cursor-ew-resize transition-colors hover:bg-peach-200 active:bg-peach-300"
            style={{ width: RESIZER_W, backgroundColor: "var(--border)" }}
            onMouseDown={createResizeHandler("right")}
            onDoubleClick={handleDoubleClick("right")}
            title="Double-click to collapse"
          />
        )}

        {/* Right panel */}
        <ErrorBoundary panel="right">
          <div
            className="relative flex-shrink-0"
            style={{
              width: rightW,
              transition: "width 200ms ease-out",
            }}
          >
            {/* Collapse toggle button */}
            <button
              onClick={togglePanelDer}
              className="absolute left-0 top-1/2 z-10 flex h-8 w-5 -translate-y-1/2 items-center justify-center rounded-r-md opacity-30 hover:opacity-80"
              style={{ backgroundColor: "var(--border)", color: "var(--text-primary)" }}
              aria-label={collapsedRight ? "Expand right panel" : "Collapse right panel"}
              title={collapsedRight ? "Expand" : "Collapse"}
            >
              {collapsedRight ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
            </button>
            <div className="overflow-hidden" style={{ width: collapsedRight ? 0 : "100%" }}>
              {!collapsedRight && rightPanel}
            </div>
          </div>
        </ErrorBoundary>
      </div>

      {/* ── Status bar ── */}
      <StatusBar />
    </div>
  );
}

export default AppShell;
