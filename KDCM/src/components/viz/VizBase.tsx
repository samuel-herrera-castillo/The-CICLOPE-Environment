import { type ReactNode, useRef, useEffect, useState } from "react";
import { Download, Maximize2 } from "lucide-react";
import * as d3 from "d3";

interface VizBaseProps {
  /** Chart title */
  title?: string;
  /** D3 rendering function: receives the SVG selection + container dimensions */
  render: (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>, dims: { w: number; h: number }) => void;
  /** Optional controls / legend rendered above the chart */
  controls?: ReactNode;
  /** Fixed height (defaults to filling the container) */
  height?: number;
  /** Called when user clicks export */
  onExport?: () => void;
}

/**
 * Base wrapper for all D3-based visualizations.
 *
 * Provides:
 * - Responsive SVG container with resize observer
 * - Download and fullscreen controls
 * - Consistent padding and theme-aware axis styling
 * - Cleanup on unmount
 *
 * Usage:
 *   <VizBase title="Word Cloud" render={(svg, dims) => { ... d3 code ... }} />
 */
export function VizBase({ title, render, controls, height, onExport }: VizBaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dims, setDims] = useState({ w: 600, h: 400 });

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height: h } = entry.contentRect;
        setDims({ w: width, h: height ?? h ?? 400 });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Render D3
  useEffect(() => {
    if (!svgRef.current || dims.w <= 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // clear previous render
    render(svg, dims);
  }, [render, dims]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2">
        {title && (
          <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            {title}
          </span>
        )}
        {controls}
        <div className="flex-1" />
        <button onClick={onExport} className="rounded p-1 hover:bg-gray-100 min-touch" aria-label="Export chart">
          <Download size={14} opacity={0.5} />
        </button>
        <button onClick={() => {
          if (containerRef.current) {
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(() => {});
            } else {
              containerRef.current.requestFullscreen().catch(() => {});
            }
          }
        }} className="rounded p-1 hover:bg-gray-100 min-touch" aria-label="Fullscreen">
          <Maximize2 size={14} opacity={0.5} />
        </button>
      </div>

      {/* Chart */}
      <div ref={containerRef} className="flex-1 overflow-hidden" style={height ? { height } : undefined}>
        <svg ref={svgRef} width={dims.w} height={dims.h} className="block" />
      </div>
    </div>
  );
}

export default VizBase;
