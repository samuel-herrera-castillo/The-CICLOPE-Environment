import { useState, useRef, useEffect, useCallback } from "react";
import {
  MousePointer2, Hand, Square, Circle, Diamond, Hexagon,
  ArrowRight, ArrowLeftRight, Type, Trash2, Undo2, Redo2,
  Save, Plus, Eye, EyeOff, Lock, Unlock, Layers,
  ChevronLeft, ChevronRight, Play, Camera,
} from "lucide-react";
import { useToast } from "../../stores/toastStore";

/* ── Exported types ── */

export interface MapLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  order: number;
}

export interface MapElement {
  id: string;
  type: "rect" | "oval" | "diamond" | "cloud" | "arrow" | "double-arrow" | "text" | "image";
  x: number; y: number; w: number; h: number;
  label: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  fontSize: number;
  fontWeight: number;
  fontStyle: string;
  textAlign: string;
  opacity: number;
  layerId: string;
  linkedEntityId?: string;
}

export interface ConceptMapData {
  name: string;
  type: string;
  elements: MapElement[];
  layers: MapLayer[];
}

/* ── Props ── */

interface ConceptMapEditorProps {
  initialName?: string;
  initialElements?: MapElement[];
  initialLayers?: MapLayer[];
  mapType?: string;
  onSave?: (elements: MapElement[], layers: MapLayer[], name: string) => void;
  onDelete?: () => void;
}

type DrawingTool = "select" | "move" | "rect" | "oval" | "diamond" | "cloud" | "arrow" | "double-arrow" | "text";

const DRAWING_TOOLS: { id: DrawingTool; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
  { id: "select", icon: MousePointer2, label: "Select" },
  { id: "move", icon: Hand, label: "Move" },
  { id: "rect", icon: Square, label: "Rectangle" },
  { id: "oval", icon: Circle, label: "Oval" },
  { id: "diamond", icon: Diamond, label: "Diamond" },
  { id: "cloud", icon: Hexagon, label: "Cloud / bubble" },
  { id: "arrow", icon: ArrowRight, label: "Arrow →" },
  { id: "double-arrow", icon: ArrowLeftRight, label: "Double arrow ↔" },
  { id: "text", icon: Type, label: "Text" },
];

/* ── Template helpers per map type ── */

function getTemplateForType(type: string): { label: string; elements: MapElement[] } {
  switch (type) {
    case "causal":
      return {
        label: "Cause → Effect",
        elements: [
          { id: "tpl-cause", type: "rect", x: 60, y: 120, w: 140, h: 60, label: "Cause", fill: "rgba(241, 215, 255, 0.5)", stroke: "#F1D7FF", strokeWidth: 2, fontSize: 15, fontWeight: 600, fontStyle: "normal", textAlign: "center", opacity: 1, layerId: "l1" },
          { id: "tpl-effect", type: "rect", x: 360, y: 120, w: 140, h: 60, label: "Effect", fill: "rgba(241, 215, 255, 0.5)", stroke: "#F1D7FF", strokeWidth: 2, fontSize: 15, fontWeight: 600, fontStyle: "normal", textAlign: "center", opacity: 1, layerId: "l1" },
          { id: "tpl-arrow", type: "arrow", x: 200, y: 145, w: 160, h: 4, label: "", fill: "transparent", stroke: "#F1D7FF", strokeWidth: 3, fontSize: 12, fontWeight: 400, fontStyle: "normal", textAlign: "center", opacity: 1, layerId: "l1" },
        ],
      };
    case "arguments":
      return {
        label: "For ↔ Against",
        elements: [
          { id: "tpl-topic", type: "rect", x: 200, y: 40, w: 160, h: 50, label: "Topic", fill: "#E3F2FD", stroke: "#1E88E5", strokeWidth: 2, fontSize: 15, fontWeight: 600, fontStyle: "normal", textAlign: "center", opacity: 1, layerId: "l1" },
          { id: "tpl-pro", type: "rect", x: 60, y: 160, w: 140, h: 50, label: "Arguments for", fill: "#E8F5E9", stroke: "#43A047", strokeWidth: 2, fontSize: 14, fontWeight: 500, fontStyle: "normal", textAlign: "center", opacity: 1, layerId: "l1" },
          { id: "tpl-con", type: "rect", x: 360, y: 160, w: 140, h: 50, label: "Arguments against", fill: "#FFEBEE", stroke: "#E53935", strokeWidth: 2, fontSize: 14, fontWeight: 500, fontStyle: "normal", textAlign: "center", opacity: 1, layerId: "l1" },
        ],
      };
    case "cases":
      return {
        label: "Comparative cases",
        elements: [
          { id: "tpl-c1", type: "rect", x: 40, y: 80, w: 140, h: 60, label: "Case 1", fill: "#F3E5F5", stroke: "#8E24AA", strokeWidth: 2, fontSize: 14, fontWeight: 600, fontStyle: "normal", textAlign: "center", opacity: 1, layerId: "l1" },
          { id: "tpl-c2", type: "rect", x: 220, y: 80, w: 140, h: 60, label: "Case 2", fill: "#E8EAF6", stroke: "#3949AB", strokeWidth: 2, fontSize: 14, fontWeight: 600, fontStyle: "normal", textAlign: "center", opacity: 1, layerId: "l1" },
          { id: "tpl-c3", type: "rect", x: 400, y: 80, w: 140, h: 60, label: "Case 3", fill: "#FFF8E1", stroke: "#F9A825", strokeWidth: 2, fontSize: 14, fontWeight: 600, fontStyle: "normal", textAlign: "center", opacity: 1, layerId: "l1" },
        ],
      };
    case "process":
      return {
        label: "Step-by-step flow",
        elements: [
          { id: "tpl-s1", type: "rect", x: 160, y: 40, w: 120, h: 44, label: "Step 1", fill: "#E8F5E9", stroke: "#66BB6A", strokeWidth: 2, fontSize: 14, fontWeight: 600, fontStyle: "normal", textAlign: "center", opacity: 1, layerId: "l1" },
          { id: "tpl-s2", type: "rect", x: 160, y: 120, w: 120, h: 44, label: "Step 2", fill: "#E8F5E9", stroke: "#66BB6A", strokeWidth: 2, fontSize: 14, fontWeight: 600, fontStyle: "normal", textAlign: "center", opacity: 1, layerId: "l1" },
          { id: "tpl-s3", type: "rect", x: 160, y: 200, w: 120, h: 44, label: "Step 3", fill: "#E8F5E9", stroke: "#66BB6A", strokeWidth: 2, fontSize: 14, fontWeight: 600, fontStyle: "normal", textAlign: "center", opacity: 1, layerId: "l1" },
        ],
      };
    default:
      return { label: "Blank canvas", elements: [] };
  }
}

/* ── Shape render helpers ── */

function shapeStyle(el: MapElement, isSelected: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    left: el.x, top: el.y, width: el.w, height: el.h,
    opacity: el.opacity,
    fontSize: el.fontSize,
    fontWeight: el.fontWeight,
    fontStyle: el.fontStyle,
    fontFamily: "'Lora', Georgia, serif",
    boxShadow: isSelected ? "0 0 0 2px var(--peach)" : undefined,
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center" as any,
    overflow: "hidden",
    cursor: "pointer",
    position: "absolute" as any,
  };

  if (el.type === "arrow" || el.type === "double-arrow") {
    return {
      ...base,
      backgroundColor: "transparent",
      border: "none",
      borderRadius: 0,
      zIndex: 0,
    };
  }

  if (el.type === "text") {
    return {
      ...base,
      backgroundColor: "transparent",
      border: "none",
    };
  }

  return {
    ...base,
    backgroundColor: el.fill,
    border: `${el.strokeWidth}px solid ${el.stroke}`,
    borderRadius: el.type === "rect" ? 6 : el.type === "cloud" ? 20 : el.type === "oval" ? "50%" : el.type === "diamond" ? 0 : 6,
  };
}

/* ── Arrow SVG component ── */

function ArrowShape({ el, isSelected }: { el: MapElement; isSelected: boolean }) {
  const isDouble = el.type === "double-arrow";

  const x1 = el.x;
  const y1 = el.y + el.h / 2;
  const x2 = el.x + el.w;
  const y2 = el.y + el.h / 2;

  return (
    <svg
      style={{
        position: "absolute", left: 0, top: 0, width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 0, overflow: "visible",
      }}
      data-me-id={el.id}
    >
      <defs>
        <marker id={`arrowhead-${el.id}`} markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill={el.stroke} />
        </marker>
        <marker id={`arrowhead-start-${el.id}`} markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
          <polygon points="10 0, 0 3.5, 10 7" fill={el.stroke} />
        </marker>
      </defs>
      <line
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={el.stroke} strokeWidth={el.strokeWidth}
        markerEnd={`url(#arrowhead-${el.id})`}
        markerStart={isDouble ? `url(#arrowhead-start-${el.id})` : undefined}
        style={{ pointerEvents: "stroke", cursor: "pointer" }}
      />
      {isSelected && (
        <rect x={el.x - 3} y={el.y - 3} width={el.w + 6} height={el.h + 6}
          fill="none" stroke="var(--peach)" strokeWidth={2} strokeDasharray="4 2" rx={2} />
      )}
    </svg>
  );
}

/* ── Main component ── */

export function ConceptMapEditor({
  initialName = "Untitled map",
  initialElements = [],
  initialLayers = [{ id: "l1", name: "Layer 1", visible: true, locked: false, order: 0 }],
  mapType = "blank",
  onSave,
  onDelete,
}: ConceptMapEditorProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Initialize from template if no elements provided and mapType has a template
  const template = getTemplateForType(mapType);
  const startElements = initialElements.length > 0 ? initialElements : template.elements;
  const startName = initialElements.length > 0 ? initialName : template.label;

  const [mapName, setMapName] = useState(startName);
  const [tool, setTool] = useState<DrawingTool>("select");
  const [elements, setElements] = useState<MapElement[]>(startElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layers, setLayers] = useState<MapLayer[]>(initialLayers);
  const [activeLayerId, setActiveLayerId] = useState(initialLayers[0]?.id ?? "l1");
  const [presentationMode, setPresentationMode] = useState(false);
  const [presLayerIdx, setPresLayerIdx] = useState(0);
  const [undoStack, setUndoStack] = useState<MapElement[][]>([]);
  const [redoStack, setRedoStack] = useState<MapElement[][]>([]);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [searchTerm] = useState("");
  const [, setSearchResults] = useState<string[]>([]);
  const [, setSearchIdx] = useState(0);
  const [fillColor, setFillColor] = useState("#FFFFFF");
  const [strokeColor, setStrokeColor] = useState("#F1D7FF");

  const activeLayer = layers.find((l) => l.id === activeLayerId);
  const isEditable = activeLayer && !activeLayer.locked;

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev, elements]);
    setRedoStack([]);
  }, [elements]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    setRedoStack((s) => [...s, elements]);
    setElements(undoStack[undoStack.length - 1]);
    setUndoStack((s) => s.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    setUndoStack((s) => [...s, elements]);
    setElements(redoStack[redoStack.length - 1]);
    setRedoStack((s) => s.slice(0, -1));
  };

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (!isEditable || tool === "select" || tool === "move") return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    pushUndo();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const isArrow = tool === "arrow" || tool === "double-arrow";
    const el: MapElement = {
      id: `me-${Date.now()}`,
      type: tool,
      x, y,
      w: isArrow ? 160 : 120,
      h: isArrow ? 4 : 80,
      label: tool === "text" ? "Text" : (isArrow ? "" : ""),
      fill: isArrow ? "transparent" : fillColor,
      stroke: strokeColor,
      strokeWidth: isArrow ? 3 : 2,
      fontSize: 14, fontWeight: 400, fontStyle: "normal", textAlign: "center",
      opacity: 1, layerId: activeLayerId,
    };
    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
    if (!isArrow) toast.success("Added", `${tool} element`);
  }, [isEditable, tool, activeLayerId, pushUndo, toast, fillColor, strokeColor]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool !== "select" && tool !== "move") return;
    const target = e.target as HTMLElement;
    const elId = target.closest("[data-me-id]")?.getAttribute("data-me-id");
    setSelectedId(elId ?? null);
    if (tool === "move" && elId) {
      setDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !selectedId) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setElements((prev) => prev.map((el) =>
      el.id === selectedId ? { ...el, x: el.x + dx, y: el.y + dy } : el));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const addLayer = () => {
    const newLayer: MapLayer = { id: `l-${Date.now()}`, name: `Layer ${layers.length + 1}`, visible: true, locked: false, order: layers.length };
    setLayers((prev) => [...prev, newLayer]);
    setActiveLayerId(newLayer.id);
    toast.success("Added", newLayer.name);
  };

  const toggleLayerVisibility = (id: string) => {
    setLayers((prev) => prev.map((l) => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const toggleLayerLock = (id: string) => {
    setLayers((prev) => prev.map((l) => l.id === id ? { ...l, locked: !l.locked } : l));
  };

  const deleteLayer = (id: string) => {
    if (layers.length <= 1) { toast.info("Cannot delete", "Need at least 1 layer"); return; }
    setLayers((prev) => prev.filter((l) => l.id !== id));
    setElements((prev) => prev.filter((el) => el.layerId !== id));
    if (activeLayerId === id) setActiveLayerId(layers.find((l) => l.id !== id)?.id ?? "l1");
    toast.success("Deleted", "Layer removed");
  };

  const handleSave = () => {
    onSave?.(elements, layers, mapName);
    toast.success("Saved", `"${mapName}" saved`);
  };

  // Presentation mode
  const visibleLayers = layers.filter((l) => l.visible);
  const currentPresLayer = visibleLayers[presLayerIdx];

  const selectedEl = elements.find((el) => el.id === selectedId);
  const visibleElements = elements.filter((el) => {
    const layer = layers.find((l) => l.id === el.layerId);
    return layer?.visible;
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        const matches = elements.filter((el) => el.label.toLowerCase().includes(searchTerm.toLowerCase())).map((el) => el.id);
        setSearchResults(matches);
        if (matches.length > 0) { setSelectedId(matches[0]); setSearchIdx(0); }
      }
      if (e.ctrlKey && e.key === "z") { e.preventDefault(); handleUndo(); }
      if (e.ctrlKey && e.key === "y") { e.preventDefault(); handleRedo(); }
      if (e.key === "Delete" && selectedId && isEditable) {
        pushUndo();
        setElements((prev) => prev.filter((el) => el.id !== selectedId));
        setSelectedId(null);
      }
      if (e.key === "Escape") { setPresentationMode(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, elements, searchTerm, isEditable, pushUndo]);

  /* ── Presentation mode ── */

  if (presentationMode) {
    return (
      <div className="fixed inset-0 z-[400] flex flex-col" style={{ backgroundColor: "#1A1A2E" }}>
        <div className="flex items-center justify-between px-4 py-2 opacity-70">
          <span className="text-white text-xs">{mapName}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPresentationMode(false)} className="text-white text-xs hover:opacity-60">Esc to exit</button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          {currentPresLayer && (
            <div className="animate-fade-in text-center" style={{ animation: "fadeIn 400ms ease-in" }}>
              <p className="text-white text-xl font-bold mb-4">{currentPresLayer.name}</p>
              <p className="text-gray-400 text-sm">{elements.filter((el) => el.layerId === currentPresLayer.id).length} elements</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-center gap-4 pb-6">
          <button onClick={() => setPresLayerIdx((i) => Math.max(0, i - 1))} disabled={presLayerIdx === 0}
            className="rounded bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-20"><ChevronLeft size={20} /></button>
          <span className="text-white text-xs">{presLayerIdx + 1} / {visibleLayers.length}</span>
          <button onClick={() => setPresLayerIdx((i) => Math.min(visibleLayers.length - 1, i + 1))} disabled={presLayerIdx >= visibleLayers.length - 1}
            className="rounded bg-white/10 p-2 text-white hover:bg-white/20 disabled:opacity-20"><ChevronRight size={20} /></button>
        </div>
      </div>
    );
  }

  /* ── Main editor ── */

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b px-3 py-1.5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <input value={mapName} onChange={(e) => setMapName(e.target.value)}
          className="rounded border px-2 py-1 text-sm font-semibold outline-none w-[180px]"
          style={{ borderColor: "var(--border)", backgroundColor: "transparent", color: "var(--text-primary)" }} />
        <button onClick={handleSave}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-secondary)" }}>
          <Save size={12} /> Save
        </button>
        <div className="flex-1" />
        <button onClick={() => { setPresentationMode(true); setPresLayerIdx(0); }}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-secondary)" }}>
          <Play size={12} /> Present
        </button>
        <button onClick={() => toast.info("Export", "Exporting PNG...")}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-secondary)" }}>
          <Camera size={12} /> Export
        </button>
        {onDelete && (
          <button onClick={onDelete}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 min-touch">
            <Trash2 size={12} /> Delete
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left — Drawing tools + Layers */}
        <div className="w-[220px] flex-shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          {/* Drawing tools */}
          <div className="border-b px-2 py-2" style={{ borderColor: "var(--border)" }}>
            <div className="flex flex-wrap gap-0.5">
              {DRAWING_TOOLS.map((t) => (
                <button key={t.id} onClick={() => setTool(t.id)}
                  className={`rounded p-1.5 min-touch ${tool === t.id ? "bg-peach-500 text-white" : "hover:bg-gray-100"}`}
                  style={{ color: tool === t.id ? "#fff" : "var(--text-secondary)" }} title={t.label}>
                  <t.icon size={14} />
                </button>
              ))}
            </div>
            <div className="flex gap-1 mt-1.5 items-center">
              <span className="text-[9px] opacity-30 mr-0.5">Fill</span>
              <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)}
                className="w-5 h-5 cursor-pointer rounded border" style={{ borderColor: "var(--border)" }} title="Fill color" />
              <span className="text-[9px] opacity-30 ml-1 mr-0.5">Stroke</span>
              <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)}
                className="w-5 h-5 cursor-pointer rounded border" style={{ borderColor: "var(--border)" }} title="Stroke color" />
              <div className="flex-1" />
              <button onClick={handleUndo} className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Undo (Ctrl+Z)"><Undo2 size={13} /></button>
              <button onClick={handleRedo} className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Redo (Ctrl+Y)"><Redo2 size={13} /></button>
            </div>
          </div>

          {/* Layers */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
              <span className="text-[10px] font-semibold uppercase opacity-30 flex items-center gap-1"><Layers size={11} /> Layers</span>
              <button onClick={addLayer} className="rounded p-0.5 hover:bg-gray-100" title="New layer"><Plus size={12} opacity={0.4} /></button>
            </div>
            {layers.map((layer) => (
              <div key={layer.id} onClick={() => setActiveLayerId(layer.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer min-touch ${
                  activeLayerId === layer.id ? "" : "hover:bg-gray-50"
                }`}
                style={{
                  backgroundColor: activeLayerId === layer.id ? "var(--peach)" + "10" : "transparent",
                  borderLeft: activeLayerId === layer.id ? "2px solid var(--peach)" : "2px solid transparent",
                  color: "var(--text-primary)",
                }}>
                <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                  className="rounded p-0.5 hover:bg-gray-200" title={layer.visible ? "Hide" : "Show"}>
                  {layer.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                </button>
                <span className="flex-1 truncate">{layer.name}</span>
                <button onClick={(e) => { e.stopPropagation(); toggleLayerLock(layer.id); }}
                  className="rounded p-0.5 hover:bg-gray-200" title={layer.locked ? "Unlock" : "Lock"}>
                  {layer.locked ? <Lock size={10} /> : <Unlock size={10} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }}
                  className="rounded p-0.5 hover:bg-red-50 opacity-30 hover:opacity-80" title="Delete layer"><Trash2 size={10} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Center — Canvas */}
        <div ref={canvasRef} className="relative flex-1 overflow-hidden"
          style={{
            backgroundImage: "radial-gradient(circle, #e0e0e0 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            cursor: tool === "move" ? "grab" : tool === "select" ? "default" : "crosshair",
          }}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={() => setDragging(false)}
          onMouseLeave={() => setDragging(false)}
        >
          {/* Render arrows as SVG */}
          {visibleElements
            .filter((el) => el.type === "arrow" || el.type === "double-arrow")
            .map((el) => (
              <ArrowShape key={el.id} el={el} isSelected={el.id === selectedId} />
            ))}

          {/* Render shapes and text as divs */}
          {visibleElements
            .filter((el) => el.type !== "arrow" && el.type !== "double-arrow")
            .map((el) => {
              const isSelected = el.id === selectedId;
              return (
                <div key={el.id} data-me-id={el.id}
                  className="absolute flex items-center justify-center cursor-pointer"
                  style={shapeStyle(el, isSelected)}
                  title={el.label}>
                  {el.label}
                </div>
              );
            })}
        </div>

        {/* Right — Element properties */}
        <div className="w-[240px] flex-shrink-0 border-l flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          <div className="border-b px-3 py-2 text-[10px] font-semibold uppercase opacity-30" style={{ borderColor: "var(--border)" }}>Properties</div>
          <div className="flex-1 overflow-y-auto p-3">
            {selectedEl ? (
              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-[10px] opacity-40 mb-0.5">Type</label>
                  <span className="text-[11px] opacity-50 capitalize">{selectedEl.type}</span>
                </div>
                {(selectedEl.type !== "arrow" && selectedEl.type !== "double-arrow") && (
                  <div>
                    <label className="block text-[10px] opacity-40 mb-0.5">Label</label>
                    <input value={selectedEl.label}
                      onChange={(e) => setElements((prev) => prev.map((el) => el.id === selectedId ? { ...el, label: e.target.value } : el))}
                      className="w-full rounded border px-2 py-1 text-xs outline-none"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                  </div>
                )}
                <div className="flex gap-4">
                  <div>
                    <label className="block text-[10px] opacity-40 mb-0.5">Fill</label>
                    <input type="color" value={selectedEl.fill}
                      onChange={(e) => setElements((prev) => prev.map((el) => el.id === selectedId ? { ...el, fill: e.target.value } : el))}
                      className="w-7 h-6 cursor-pointer rounded border" style={{ borderColor: "var(--border)" }} />
                  </div>
                  <div>
                    <label className="block text-[10px] opacity-40 mb-0.5">Stroke</label>
                    <input type="color" value={selectedEl.stroke}
                      onChange={(e) => setElements((prev) => prev.map((el) => el.id === selectedId ? { ...el, stroke: e.target.value } : el))}
                      className="w-7 h-6 cursor-pointer rounded border" style={{ borderColor: "var(--border)" }} />
                  </div>
                </div>
                <button onClick={() => { pushUndo(); setElements((prev) => prev.filter((el) => el.id !== selectedId)); setSelectedId(null); }}
                  className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-red-500 hover:bg-red-50 min-touch">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            ) : (
              <p className="text-[10px] opacity-20 text-center pt-6">Select an element to edit</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConceptMapEditor;
