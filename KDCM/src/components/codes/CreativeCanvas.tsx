import { useState, useCallback, useRef, useEffect } from "react";
import {
  MousePointer2, Hand, Plus, StickyNote, ArrowRight, Circle,
  Trash2, Undo2, Redo2, Camera, Magnet, Network,
  Image, Download, Grid3X3, ZoomIn,
} from "lucide-react";
import { useToast } from "../../stores/toastStore";

type Tool = "select" | "move" | "add-cat" | "note" | "arrow" | "bubble";
type ExportFmt = "png" | "svg" | "pdf" | "json";

interface CanvasElement {
  id: string;
  type: "category" | "note" | "arrow" | "bubble";
  x: number; y: number; w: number; h: number;
  label: string;
  color: string;
  toId?: string;
  layer: number;
}

const TOOLS: { id: Tool; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
  { id: "select", icon: MousePointer2, label: "Select" },
  { id: "move", icon: Hand, label: "Move" },
  { id: "add-cat", icon: Plus, label: "Add category" },
  { id: "note", icon: StickyNote, label: "Note" },
  { id: "arrow", icon: ArrowRight, label: "Arrow" },
  { id: "bubble", icon: Circle, label: "Bubble" },
];

export function CreativeCanvas() {
  const [tool, setTool] = useState<Tool>("select");
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [magneticGrid, setMagneticGrid] = useState(false);
  const [undoStack, setUndoStack] = useState<CanvasElement[][]>([]);
  const [redoStack, setRedoStack] = useState<CanvasElement[][]>([]);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Autosave every 60s
  useEffect(() => {
    const id = setInterval(() => {
      try { localStorage.setItem("kdcm-canvas", JSON.stringify(elements)); } catch { /* */ }
    }, 60000);
    return () => clearInterval(id);
  }, [elements]);

  // Restore on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("kdcm-canvas");
      if (saved) setElements(JSON.parse(saved));
    } catch { /* */ }
  }, []);

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev, elements]);
    setRedoStack([]);
  }, [elements]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((s) => [...s, elements]);
    setElements(prev);
    setUndoStack((s) => s.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((s) => [...s, elements]);
    setElements(next);
    setRedoStack((s) => s.slice(0, -1));
  };

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (tool === "select" || tool === "move") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    pushUndo();
    let x = (e.clientX - rect.left) / zoom;
    let y = (e.clientY - rect.top) / zoom;
    // Magnetic grid: snap to 20px
    if (magneticGrid) {
      x = Math.round(x / 20) * 20;
      y = Math.round(y / 20) * 20;
    }
    const id = `el-${Date.now()}`;
    const el: CanvasElement = {
      id, x, y, w: tool === "bubble" ? 100 : 120,
      h: tool === "bubble" ? 80 : 50,
      label: tool === "add-cat" ? "New category" : tool === "note" ? "Note" : tool === "bubble" ? "Bubble" : "→",
      color: "#F1D7FF",
      type: tool === "add-cat" ? "category" : tool === "note" ? "note" : tool === "bubble" ? "bubble" : "arrow",
      layer: elements.length,
    };
    setElements((prev) => [...prev, el]);
    setSelectedId(id);
    toast.success("Added", `${tool} element`);
  }, [tool, zoom, elements, magneticGrid, pushUndo, toast]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (tool !== "select" && tool !== "move") return;
    const target = e.target as HTMLElement;
    const elId = target.closest("[data-el-id]")?.getAttribute("data-el-id");
    if (elId) setSelectedId(elId);
    if (tool === "move" && elId) {
      setDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [tool]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !selectedId) return;
    const dx = (e.clientX - dragStart.x) / zoom;
    const dy = (e.clientY - dragStart.y) / zoom;
    setElements((prev) => prev.map((el) =>
      el.id === selectedId ? { ...el, x: el.x + dx, y: el.y + dy } : el));
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [dragging, selectedId, dragStart, zoom]);

  const handleMouseUp = () => setDragging(false);

  // Ctrl+D duplicate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "d" && selectedId) {
        e.preventDefault();
        const orig = elements.find((el) => el.id === selectedId);
        if (orig) {
          const dup = { ...orig, id: `el-${Date.now()}`, x: orig.x + 30, y: orig.y + 30, layer: elements.length };
          setElements((prev) => [...prev, dup]);
          setSelectedId(dup.id);
          toast.success("Duplicated");
        }
      }
      if (e.ctrlKey && e.key === "z") { e.preventDefault(); handleUndo(); }
      if (e.ctrlKey && e.key === "y") { e.preventDefault(); handleRedo(); }
      if (e.key === "Delete" && selectedId) {
        pushUndo();
        setElements((prev) => prev.filter((el) => el.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, elements, toast, pushUndo, undoStack, redoStack]);

  const handleExport = (fmt: ExportFmt) => {
    if (fmt === "json") {
      const blob = new Blob([JSON.stringify(elements, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = globalThis.document.createElement("a");
      a.href = url; a.download = "canvas.json"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported as JSON");
    } else if (fmt === "svg") {
      // Generate SVG from canvas elements
      const svgParts: string[] = [];
      svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">`);
      svgParts.push(`<rect width="800" height="600" fill="#fff"/>`);
      elements.forEach((el) => {
        const rx = el.type === "bubble" ? el.w / 2 : 8;
        svgParts.push(`<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${rx}" fill="${el.color}20" stroke="${el.color}" stroke-width="2"/>`);
        svgParts.push(`<text x="${el.x + el.w/2}" y="${el.y + el.h/2 + 4}" text-anchor="middle" font-size="12" font-family="sans-serif" fill="#333">${el.label}</text>`);
      });
      svgParts.push(`</svg>`);
      const blob = new Blob([svgParts.join("\n")], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = globalThis.document.createElement("a");
      a.href = url; a.download = "canvas.svg"; a.click();
      URL.revokeObjectURL(url);
      toast.success("Exported as SVG");
    } else {
      toast.info("Export", `Export as ${fmt.toUpperCase()} coming soon`);
    }
  };

  // Drop handler — accept categories dragged from tree
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    try {
      const cat = JSON.parse(data);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left) / zoom - 60;
      const y = (e.clientY - rect.top) / zoom - 25;
      pushUndo();
      const el: CanvasElement = {
        id: `el-${Date.now()}`, x, y, w: 120, h: 50,
        label: cat.name, color: cat.color ?? "#F1D7FF",
        type: "category", layer: elements.length,
      };
      setElements((prev) => [...prev, el]);
      toast.success("Added", `Category "${cat.name}" from tree`);
    } catch { /* ignore */ }
  }, [zoom, elements, pushUndo, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const selectedEl = elements.find((el) => el.id === selectedId);

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b px-2 py-1" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTool(t.id)}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium min-touch ${tool === t.id ? "bg-peach-500 text-white" : "hover:bg-gray-100"}`}
              style={{ color: tool === t.id ? "#fff" : "var(--text-secondary)" }} title={t.label}>
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
        <div className="w-px h-5 opacity-20 mx-1" style={{ backgroundColor: "var(--text-secondary)" }} />
        <button onClick={() => { pushUndo(); setElements((prev) => prev.filter((el) => el.id !== selectedId)); setSelectedId(null); }}
          className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Delete"><Trash2 size={13} /></button>
        <button onClick={handleUndo} className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Undo"><Undo2 size={13} /></button>
        <button onClick={handleRedo} className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Redo"><Redo2 size={13} /></button>
        <div className="w-px h-5 opacity-20 mx-1" style={{ backgroundColor: "var(--text-secondary)" }} />
        <button onClick={() => setMagneticGrid((g) => !g)}
          className={`rounded p-1.5 min-touch ${magneticGrid ? "bg-peach-100" : "hover:bg-gray-100"}`}
          style={{ color: magneticGrid ? "#000" : "#000" }}
          title="Magnetic grid (snap to 20px)"><Magnet size={13} /></button>
        <button onClick={() => setShowGrid((g) => !g)}
          className={`rounded p-1.5 min-touch ${showGrid ? "bg-peach-100" : "hover:bg-gray-100"}`}
          style={{ color: showGrid ? undefined : "var(--text-secondary)" }} title="Toggle grid"><Grid3X3 size={13} /></button>
        <div className="flex items-center gap-1">
          <ZoomIn size={12} opacity={0.4} />
          <input type="range" min={0.25} max={2} step={0.25} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))} className="w-20" style={{ accentColor: "var(--peach)" }} />
          <span className="text-[10px] opacity-40 w-8">{Math.round(zoom * 100)}%</span>
        </div>
        <div className="flex-1" />
        <div className="flex gap-1">
          <button
            onClick={() => toast.info("Drag", "Drag categories from the tree panel onto the canvas")}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch"
            style={{ color: "var(--text-secondary)" }} title="Add from tree">
            <Plus size={12} /> From tree
          </button>
          <div className="w-px h-5 opacity-20 mx-0.5" style={{ backgroundColor: "var(--text-secondary)" }} />
          <button onClick={() => handleExport("png")} className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Export PNG"><Camera size={13} /></button>
          <button onClick={() => handleExport("svg")} className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Export SVG"><Image size={13} /></button>
          <button onClick={() => handleExport("json")} className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Export JSON"><Download size={13} /></button>
          <button
            onClick={() => toast.info("Convert", "Converting canvas to concept map...")}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium hover:bg-peach-100 min-touch"
            style={{ color: "#000" }} title="Convert to concept map">
            <Network size={12} /> Convert to map
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={canvasRef} className="relative flex-1 overflow-hidden"
        style={{
          backgroundImage: showGrid ? "radial-gradient(circle, #ddd 1px, transparent 1px)" : undefined,
          backgroundSize: showGrid ? `${20 * zoom}px ${20 * zoom}px` : undefined,
          cursor: tool === "move" ? "grab" : tool === "select" ? "default" : "crosshair",
        }}
        onClick={handleCanvasClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div style={{ transform: `scale(${zoom})`, transformOrigin: "0 0" }}>
          {elements.map((el) => {
            const isSelected = el.id === selectedId;
            return (
              <div key={el.id} data-el-id={el.id}
                className="absolute flex items-center justify-center rounded-md border-2 cursor-pointer text-xs font-medium select-none"
                style={{
                  left: el.x, top: el.y, width: el.w, height: el.h,
                  backgroundColor: el.color + "20", borderColor: isSelected ? el.color : el.color + "40",
                  borderRadius: el.type === "bubble" ? "50%" : el.type === "note" ? 4 : 8,
                  zIndex: el.layer,
                  boxShadow: isSelected ? `0 0 0 2px ${el.color}` : undefined,
                }}>
                {el.type === "arrow" ? "→" : el.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Inspector for selected element */}
      {selectedEl && (
        <div className="flex items-center gap-2 border-t px-3 py-1.5 text-xs" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          <span className="opacity-40">{selectedEl.type}</span>
          <input value={selectedEl.label} onChange={(e) => setElements((prev) => prev.map((el) => el.id === selectedId ? { ...el, label: e.target.value } : el))}
            className="rounded border px-2 py-1 flex-1 outline-none" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
          <input type="color" value={selectedEl.color}
            onChange={(e) => setElements((prev) => prev.map((el2) => el2.id === selectedId ? { ...el2, color: e.target.value } : el2))}
            className="w-7 h-6 cursor-pointer rounded border" style={{ borderColor: "var(--border)" }} />
          <span className="opacity-30 text-[10px]">Ctrl+D duplicate · Del delete · Ctrl+Z undo</span>
        </div>
      )}
    </div>
  );
}

export default CreativeCanvas;
