import { useState, useCallback, useRef, useEffect } from "react";
import {
  ZoomIn, ZoomOut, Maximize2, RotateCw, RotateCcw,
  FlipHorizontal, FlipVertical, Square, Ruler, Printer,
  Eye, Trash2, X, Save,
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { usePositionMemory } from "../../lib/positionMemory";
import { useToast } from "../../stores/toastStore";

/* ── Types ── */

interface ImageRegion {
  id: string;
  x: number; y: number; w: number; h: number;
  category: string;
  categoryColor: string;
  comment?: string;
  weight: number;
}

interface ImageViewerProps {
  src: string;
  alt: string;
  documentId?: string;
}

/* ── Checkered background SVG ── */
const CHECKER_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='8' height='8' fill='%23E8E8E8'/%3E%3Crect x='8' y='8' width='8' height='8' fill='%23E8E8E8'/%3E%3C/svg%3E")`;

/* ══════════════════════════════════════════════════════
   Region panel (right sidebar)
   ══════════════════════════════════════════════════════ */

function RegionPanel({
  regions, activeId, onSelect, onDelete, onAdd,
}: {
  regions: ImageRegion[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  if (regions.length === 0) {
    return (
      <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-panel)" }}>
        <div className="border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
            Coded regions (0)
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center p-4 text-center">
          <p className="text-xs opacity-30">
            Use the selection tool [🔲] to mark a region on the image.
          </p>
        </div>
        <div className="border-t px-3 py-2" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={onAdd}
            className="flex w-full items-center justify-center gap-1 rounded-md border py-1.5 text-xs font-medium hover:bg-gray-50"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            + New region
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-panel)" }}>
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          Coded regions ({regions.length})
        </span>
        <button onClick={onAdd} className="rounded p-0.5 hover:bg-gray-100 text-xs" style={{ color: "#000" }}>
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {regions.map((r, i) => {
          const isActive = r.id === activeId;
          return (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={`group flex w-full items-center gap-2 border-b px-3 py-2 text-left text-xs transition-colors hover:bg-gray-50 ${
                isActive ? "font-medium" : ""
              }`}
              style={{
                borderColor: "var(--border)",
                backgroundColor: isActive ? "var(--bg-secondary)" : "transparent",
              }}
            >
              <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: r.categoryColor }} />
              <span className="text-[10px] opacity-40 flex-shrink-0">#{i + 1}</span>
              <span className="flex-1 truncate" style={{ color: "var(--text-primary)" }}>{r.category || "Uncategorized"}</span>
              <span className="text-[10px] opacity-30 flex-shrink-0">{r.w}×{r.h}px</span>
              <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onMouseDown={(e) => e.stopPropagation()}>
                <button onClick={(e) => { e.stopPropagation(); onSelect(r.id); }} className="rounded p-0.5 hover:bg-gray-200" aria-label="View">
                  <Eye size={11} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(r.id); }} className="rounded p-0.5 hover:bg-gray-200 text-red-500" aria-label="Delete">
                  <Trash2 size={11} />
                </button>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Selection panel (floating)
   ══════════════════════════════════════════════════════ */

function SelectionPanel({
  region, onSave, onClose, imageSrc,
}: {
  region: { x: number; y: number; w: number; h: number; preview?: string };
  onSave: (category: string, color: string, comment: string, weight: number) => void;
  onClose: () => void;
  imageSrc?: string;
}) {
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("#F1D7FF");
  const [comment, setComment] = useState("");
  const [weight, setWeight] = useState(50);
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const projectCategories = useProjectStore((s) => s.categories);

  return (
    <div
      className="absolute right-4 top-14 z-30 w-[280px] rounded-lg p-4 shadow-xl"
      style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--border)" }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          New region · {Math.round(region.w)}×{Math.round(region.h)}px
        </span>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="rounded p-0.5 hover:bg-gray-100"><X size={14} /></button>
      </div>

      {/* Cropped preview */}
      <div
        className="mb-3 flex h-[80px] w-full items-center justify-center rounded-md border overflow-hidden"
        style={{ borderColor: "var(--border)", backgroundColor: "#E8E8E8" }}
      >
        {imageSrc ? (
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `url(${imageSrc})`,
              backgroundPosition: `-${region.x}px -${region.y}px`,
              backgroundSize: `${100 / region.w * 80}px auto`,
              transform: "scale(1)",
            }}
          />
        ) : (
          <span className="text-[10px] opacity-30">Region preview</span>
        )}
      </div>

      {/* Category combobox — type new or select existing */}
      <div className="relative mb-2" onMouseDown={(e) => e.stopPropagation()}>
        <input value={category} onChange={(e) => { setCategory(e.target.value); setShowCatDropdown(true); }}
          onFocus={() => setShowCatDropdown(true)}
          onBlur={() => setTimeout(() => setShowCatDropdown(false), 200)}
          placeholder="Category — type new or select existing"
          onKeyDown={(e) => e.stopPropagation()}
          className="w-full rounded border px-2.5 py-1.5 text-xs outline-none"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
        />
        {showCatDropdown && projectCategories.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-0.5 max-h-[120px] overflow-y-auto rounded-md border bg-white shadow-lg"
            style={{ borderColor: "var(--border)" }}>
            {projectCategories
              .filter((c) => !category || c.name.toLowerCase().includes(category.toLowerCase()))
              .slice(0, 8)
              .map((cat) => (
                <button key={cat.id}
                  onMouseDown={(e) => { e.preventDefault(); setCategory(cat.name); setShowCatDropdown(false); }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-gray-100"
                  style={{ color: "var(--text-primary)" }}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="truncate">{cat.name}</span>
                </button>
              ))}
            {category && !projectCategories.some((c) => c.name.toLowerCase() === category.toLowerCase()) && (
              <div className="px-2.5 py-1.5 text-xs opacity-40 italic">Press Save to create "{category}"</div>
            )}
          </div>
        )}
      </div>

      <div className="mb-2 flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
        <span className="text-[10px] opacity-40">Color</span>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded border" style={{ borderColor: "var(--border)" }} />
        <span className="text-[10px] font-mono opacity-40">{color}</span>
      </div>

      <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comment (optional)" rows={2}
        onMouseDown={(e) => e.stopPropagation()}
        className="mb-2 w-full resize-none rounded border px-2.5 py-1.5 text-xs outline-none"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />

      <div className="mb-3 flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
        <span className="text-[10px] opacity-40">Weight</span>
        <input type="range" min={1} max={100} value={weight} onChange={(e) => setWeight(Number(e.target.value))}
          className="flex-1" style={{ accentColor: "var(--peach)" }} />
        <span className="text-[10px] font-mono opacity-40">{weight}</span>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}
          className="rounded px-3 py-1.5 text-xs hover:bg-gray-100"
          style={{ color: "var(--text-secondary)" }}>Cancel</button>
        <button
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onSave(category, color, comment, weight); }}
          className="flex items-center gap-1 rounded-md bg-peach-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-peach-700">
          <Save size={12} /> Save
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   IMAGE VIEWER (main)
   ══════════════════════════════════════════════════════ */

export function ImageViewer({ src, alt, documentId }: ImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const proyectoId = useProjectStore((s) => s.project?.id);
  const { restorePosition, savePage: saveImgPage, saveZoom: saveImgZoom, flushPosition: flushImgPos } = usePositionMemory(documentId, proyectoId);
  const { toast } = useToast();

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Restore saved zoom and pan on mount
  useEffect(() => {
    if (!documentId) return;
    restorePosition().then((pos) => {
      if (pos) {
        if (pos.zoom) setZoom(pos.zoom);
        if (pos.pagina || pos.scroll_y) setPan({ x: pos.pagina || 0, y: pos.scroll_y || 0 });
      }
    });
  }, [documentId]);

  // Save zoom on change (debounce 500ms)
  useEffect(() => {
    if (!documentId || zoom === 1) return;
    const t = setTimeout(() => saveImgZoom(zoom), 500);
    return () => clearTimeout(t);
  }, [zoom, documentId]);

  // Save pan on change (debounce 1000ms)
  useEffect(() => {
    if (!documentId || (pan.x === 0 && pan.y === 0)) return;
    const t = setTimeout(() => saveImgPage(pan.x, pan.y, zoom), 1000);
    return () => clearTimeout(t);
  }, [pan, documentId]);

  // Flush position on unmount
  useEffect(() => { return () => { flushImgPos(); }; }, [documentId]);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Selection mode
  const [selectMode, setSelectMode] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selStart, setSelStart] = useState({ x: 0, y: 0 });
  const [selRect, setSelRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [showSelPanel, setShowSelPanel] = useState(false);

  // Regions
  const [regions, setRegions] = useState<ImageRegion[]>([]);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);

  // ── Zoom centered on cursor ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(20, zoom * factor));

    // Adjust pan to keep cursor point stationary
    const scaleChange = newZoom / zoom;
    setPan((p) => ({
      x: cx - scaleChange * (cx - p.x),
      y: cy - scaleChange * (cy - p.y),
    }));
    setZoom(newZoom);
  }, [zoom]);

  // ── Pan with drag ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    if (selectMode) {
      // Start selection rectangle
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setSelecting(true);
      setSelStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setSelRect(null);
      return;
    }

    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setPanStart({ ...pan });
  }, [selectMode, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (selecting) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      setSelRect({
        x: Math.min(selStart.x, cx),
        y: Math.min(selStart.y, cy),
        w: Math.abs(cx - selStart.x),
        h: Math.abs(cy - selStart.y),
      });
      return;
    }

    if (!dragging) return;
    setPan({
      x: panStart.x + (e.clientX - dragStart.x),
      y: panStart.y + (e.clientY - dragStart.y),
    });
  }, [dragging, dragStart, panStart, selecting, selStart]);

  const handleMouseUp = useCallback(() => {
    if (selecting && selRect && selRect.w > 10 && selRect.h > 10) {
      // Adjust for zoom/pan to get image-space coordinates
      const imgScale = 1 / zoom;
      const imgX = (selRect.x - pan.x) * imgScale;
      const imgY = (selRect.y - pan.y) * imgScale;
      const imgW = selRect.w * imgScale;
      const imgH = selRect.h * imgScale;
      setSelRect({ x: imgX, y: imgY, w: imgW, h: imgH });
      setShowSelPanel(true);
    }
    setSelecting(false);
    setDragging(false);
  }, [selecting, selRect, zoom, pan]);

  // ── Double-click: toggle fit/100% ──
  const handleDoubleClick = useCallback(() => {
    if (zoom !== 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      // Fit to container
      const cw = containerRef.current?.clientWidth ?? 800;
      const ch = containerRef.current?.clientHeight ?? 600;
      const img = imageRef.current;
      if (img && img.naturalWidth > 0) {
        const fitZoom = Math.min(cw / img.naturalWidth, ch / img.naturalHeight) * 0.9;
        setZoom(fitZoom);
        setPan({
          x: (cw - img.naturalWidth * fitZoom) / 2,
          y: (ch - img.naturalHeight * fitZoom) / 2,
        });
      }
    }
  }, [zoom]);

  const addCategory = useProjectStore((s) => s.addCategory);

  // ── Save region ──
  const handleSaveRegion = useCallback((category: string, color: string, comment: string, weight: number) => {
    if (!selRect) return;
    const name = category || "Uncategorized";
    // Add to local regions display
    setRegions((prev) => [
      ...prev,
      {
        id: `r${Date.now()}`,
        x: selRect.x, y: selRect.y, w: selRect.w, h: selRect.h,
        category: name,
        categoryColor: color,
        comment: comment || undefined,
        weight,
      },
    ]);
    // Also add as a project category so it integrates with the coding system
    addCategory({
      id: `img-${Date.now()}`,
      name,
      color,
      parentId: null,
      count: 1,
      description: `Image region ${Math.round(selRect.w)}×${Math.round(selRect.h)}px` + (comment ? ` — ${comment}` : ""),
    });
    setShowSelPanel(false);
    setSelRect(null);
    setSelectMode(false);
    alert(`Region saved as category: "${name}" (${Math.round(selRect.w)}×${Math.round(selRect.h)}px, weight: ${weight})`);
  }, [selRect, addCategory]);

  // ── Select region → center & highlight ──
  const handleSelectRegion = useCallback((id: string) => {
    setActiveRegion(id);
    const region = regions.find((r) => r.id === id);
    if (!region || !containerRef.current) return;

    // Animate: zoom to fit the region centered in viewport
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const targetZoom = Math.min(cw / region.w, ch / region.h) * 0.7;
    setZoom(targetZoom);
    setPan({
      x: cw / 2 - (region.x + region.w / 2) * targetZoom,
      y: ch / 2 - (region.y + region.h / 2) * targetZoom,
    });
  }, [regions]);

  return (
    <div className="flex h-full flex-col">
      {/* ═══ Toolbar ═══ */}
      <div className="flex items-center gap-1 border-b px-3 py-1.5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <button onClick={() => setZoom((z) => Math.max(0.1, z * 0.8))} className="rounded p-1 hover:bg-gray-100 min-touch" aria-label="Zoom out">
          <ZoomIn size={15} style={{ transform: "scaleX(-1)" }} />
        </button>
        <button onClick={() => setZoom((z) => Math.min(20, z * 1.25))} className="rounded p-1 hover:bg-gray-100 min-touch" aria-label="Zoom in">
          <ZoomOut size={15} style={{ transform: "scaleX(-1)" }} />
        </button>
        <button onClick={handleDoubleClick} className="rounded p-1 hover:bg-gray-100 min-touch" aria-label="Fit / 100%">
          <Maximize2 size={14} />
        </button>

        <span className="mx-1 text-[11px] font-mono opacity-50 w-[40px] text-center">
          {Math.round(zoom * 100)}%
        </span>

        <div className="w-px h-4 opacity-20" style={{ backgroundColor: "var(--text-secondary)" }} />

        <button onClick={() => setRotation((r) => r - 90)} className="rounded p-1 hover:bg-gray-100 min-touch" aria-label="Rotate left">
          <RotateCcw size={14} />
        </button>
        <button onClick={() => setRotation((r) => r + 90)} className="rounded p-1 hover:bg-gray-100 min-touch" aria-label="Rotate right">
          <RotateCw size={14} />
        </button>
        <button onClick={() => setFlipH((f) => !f)} className={`rounded p-1 min-touch ${flipH ? "bg-peach-100" : "hover:bg-gray-100"}`} aria-label="Flip horizontal">
          <FlipHorizontal size={14} />
        </button>
        <button onClick={() => setFlipV((f) => !f)} className={`rounded p-1 min-touch ${flipV ? "bg-peach-100" : "hover:bg-gray-100"}`} aria-label="Flip vertical">
          <FlipVertical size={14} />
        </button>

        <div className="w-px h-4 opacity-20" style={{ backgroundColor: "var(--text-secondary)" }} />

        <button
          onClick={() => setSelectMode((m) => !m)}
          className={`rounded p-1 min-touch ${selectMode ? "bg-peach-500 text-white" : "hover:bg-gray-100"}`}
          aria-label="Select region"
          title="Select region"
        >
          <Square size={14} />
        </button>
        <button onClick={() => toast.info("Measure", "Use the selection tool to measure regions on the image")}
          className="rounded p-1 hover:bg-gray-100 min-touch" aria-label="Measure">
          <Ruler size={14} />
        </button>
        <button onClick={() => window.print()} className="rounded p-1 hover:bg-gray-100 min-touch" aria-label="Print">
          <Printer size={14} />
        </button>

        {selectMode && (
          <span className="ml-1 text-[10px] font-medium" style={{ color: "#000" }}>
            Selection mode — drag on image
          </span>
        )}
      </div>

      {/* ═══ Main area: image + regions panel ═══ */}
      <div className="flex flex-1 overflow-hidden">
        {/* Image viewport */}
        <div
          ref={containerRef}
          className="relative flex-1 overflow-hidden"
          style={{
            backgroundImage: CHECKER_SVG,
            backgroundRepeat: "repeat",
            cursor: selectMode ? "crosshair" : dragging ? "grabbing" : "grab",
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setDragging(false); setSelecting(false); }}
          onDoubleClick={handleDoubleClick}
        >
          {/* Image */}
          <img
            ref={imageRef}
            src={src}
            alt={alt}
            draggable={false}
            className="absolute select-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
              transformOrigin: "0 0",
              transition: dragging ? "none" : "transform 100ms ease-out",
            }}
            onLoad={() => {
              // Auto-fit on first load
              const cw = containerRef.current?.clientWidth ?? 800;
              const ch = containerRef.current?.clientHeight ?? 600;
              const img = imageRef.current;
              if (img && img.naturalWidth > 0) {
                const fitZ = Math.min(cw / img.naturalWidth, ch / img.naturalHeight) * 0.85;
                setZoom(fitZ);
                setPan({
                  x: (cw - img.naturalWidth * fitZ) / 2,
                  y: (ch - img.naturalHeight * fitZ) / 2,
                });
              }
            }}
          />

          {/* ═══ Coded regions overlay ═══ */}
          {regions.map((r) => {
            const isActive = r.id === activeRegion;
            return (
              <div
                key={r.id}
                className={`absolute cursor-pointer transition-all ${isActive ? "ring-2 ring-peach-500 ring-offset-1 z-10" : ""}`}
                style={{
                  left: pan.x + r.x * zoom,
                  top: pan.y + r.y * zoom,
                  width: r.w * zoom,
                  height: r.h * zoom,
                  backgroundColor: r.categoryColor + "40",
                  border: `2px solid ${r.categoryColor}`,
                  animation: isActive ? "region-pulse 1.5s ease-in-out infinite" : undefined,
                }}
                onClick={(e) => { e.stopPropagation(); handleSelectRegion(r.id); }}
                title={`${r.category}${r.comment ? ` — ${r.comment}` : ""}`}
              >
                <span
                  className="absolute -top-5 left-0 rounded px-1.5 py-0 text-[9px] font-medium text-white whitespace-nowrap pointer-events-none"
                  style={{ backgroundColor: r.categoryColor }}
                >
                  {r.category}
                </span>
              </div>
            );
          })}

          {/* ═══ Selection rectangle (during drag) ═══ */}
          {selecting && selRect && (
            <div
              className="absolute border-2 border-peach-500 pointer-events-none"
              style={{
                left: selRect.x, top: selRect.y,
                width: selRect.w, height: selRect.h,
                backgroundColor: "rgba(232, 101, 10, 0.15)",
              }}
            />
          )}

          {/* Selection panel (floating) */}
          {showSelPanel && selRect && (
            <SelectionPanel
              region={selRect}
              imageSrc={src}
              onSave={handleSaveRegion}
              onClose={() => { setShowSelPanel(false); setSelRect(null); }}
            />
          )}

          {/* Pulse animation for active region */}
          <style>{`
            @keyframes region-pulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(232, 101, 10, 0.4); }
              50%      { box-shadow: 0 0 0 6px rgba(232, 101, 10, 0); }
            }
          `}</style>
        </div>

        {/* ═══ Regions panel (right sidebar) ═══ */}
        <div className="w-[260px] flex-shrink-0 border-l" style={{ borderColor: "var(--border)" }}>
          <RegionPanel
            regions={regions}
            activeId={activeRegion}
            onSelect={handleSelectRegion}
            onDelete={(id) => { setRegions((prev) => prev.filter((r) => r.id !== id)); setActiveRegion(null); }}
            onAdd={() => setSelectMode(true)}
          />
        </div>
      </div>
    </div>
  );
}

export default ImageViewer;
