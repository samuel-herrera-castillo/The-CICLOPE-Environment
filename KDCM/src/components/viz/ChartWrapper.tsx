import React, { useRef, useEffect, useState, useCallback } from "react";
import { Maximize2, Minimize2, Camera, Download } from "lucide-react";

interface Props {
  categories?: { name: string; color: string; id: string }[];
  minCategories?: number;
  chartName: string;
  children: React.ReactNode;
}

/** Wraps a D3 chart with ResizeObserver, EmptyState, fullscreen, export, reduced-motion, and performance warnings */
export function ChartWrapper({ categories, minCategories = 1, chartName, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [, setSize] = useState({ w: 800, h: 500 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          setSize({ w, h });
          setRefreshKey(k => k + 1);
        }
      }
    });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const hasData = categories && categories.length >= minCategories;

  // Performance warning
  const catCount = categories?.length || 0;
  const perfWarn = catCount > 200 ? `⚠ ${catCount} nodes. Consider filtering.` : null;

  const handleExportPNG = useCallback(() => {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const s = new XMLSerializer().serializeToString(svg);
    const b = new Blob([s], { type: "image/svg+xml" });
    const url = URL.createObjectURL(b);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 1600; c.height = 1200;
      c.getContext("2d")!.fillStyle = "#fff";
      c.getContext("2d")!.fillRect(0, 0, 1600, 1200);
      c.getContext("2d")!.drawImage(img, 0, 0, 1600, 1200);
      const a = document.createElement("a");
      a.href = c.toDataURL("image/png");
      a.download = chartName.replace(/\s/g, "_") + ".png";
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [chartName]);

  const handleExportSVG = useCallback(() => {
    const svg = ref.current?.querySelector("svg");
    if (!svg) return;
    const s = new XMLSerializer().serializeToString(svg);
    const b = new Blob([s], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = chartName.replace(/\s/g, "_") + ".svg";
    a.click();
  }, [chartName]);

  const handleExportCSV = useCallback(() => {
    const csv = "category,value\n" + (categories || []).map(c => `${c.name},${0}`).join("\n");
    const b = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = chartName.replace(/\s/g, "_") + ".csv";
    a.click();
  }, [chartName, categories]);

  const containerStyle: React.CSSProperties = fullscreen
    ? { position: "fixed", inset: 0, zIndex: 500, backgroundColor: "var(--bg-primary)" }
    : { width: "100%", height: "100%", position: "relative" };

  return (
    <div ref={ref} style={containerStyle}>
      {/* Toolbar */}
      <div style={{ position: "absolute", top: 0, right: 0, zIndex: 10, display: "flex", gap: 2, padding: 4 }}>
        <button onClick={handleExportPNG} className="rounded p-1 hover:bg-gray-100 min-touch" title="PNG"><Camera size={13} opacity={0.4} /></button>
        <button onClick={handleExportSVG} className="rounded p-1 hover:bg-gray-100 min-touch" title="SVG"><Download size={13} opacity={0.4} /></button>
        <button onClick={handleExportCSV} className="rounded p-1 hover:bg-gray-100 min-touch text-[9px] font-medium opacity-40" title="CSV">CSV</button>
        <button onClick={() => setFullscreen(!fullscreen)} className="rounded p-1 hover:bg-gray-100 min-touch" title="Fullscreen">
          {fullscreen ? <Minimize2 size={13} opacity={0.4} /> : <Maximize2 size={13} opacity={0.4} />}
        </button>
      </div>

      {perfWarn && (
        <div style={{ position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)", zIndex: 10, background: "#FFF3CD", border: "1px solid #FFC107", borderRadius: 4, padding: "2px 8px", fontSize: 10, color: "#856404" }}>
          {perfWarn}
        </div>
      )}

      {hasData ? (
        <div key={refreshKey} style={{ width: "100%", height: "100%", animation: reducedMotion ? "none" : `fadeInChart 0.3s ease-out` }}>
          {children}
          <style>{`@keyframes fadeInChart { from { opacity:0; transform:scale(0.98) } to { opacity:1; transform:scale(1) } }`}</style>
        </div>
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{chartName}</p>
            <p style={{ fontSize: 11, opacity: 0.3, marginTop: 4 }}>
              {minCategories > 1 ? `Need at least ${minCategories} categories with segments` : "No data available. Create categories and code segments first."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
