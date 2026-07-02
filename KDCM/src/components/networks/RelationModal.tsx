import { useState } from "react";
import { X, Plus, Eye, ArrowRight, ArrowLeftRight, Minus } from "lucide-react";
import { PRESETS, type RelationType } from "./RelationTypeAdmin";
import { execQuery } from "../../lib/tauriBridge";
import { useProjectStore } from "../../stores/projectStore";

interface NetNode { id: string; label: string; color: string; }
interface NetEdge { id: string; source: string; target: string; label: string; color: string; width: number; style: string; direction: string; arrowType: string; opacity: number; curvature: number; comment: string; labelPos: string; labelBg: boolean; }

interface Props { source: NetNode; target: NetNode; onConfirm: (edge: NetEdge, newRelation?: RelationType) => void; onCancel: () => void; existingEdge?: NetEdge | null; }

const LINE_STYLES = [
  { id: "solid", label: "──── Continuous", dash: "" },
  { id: "dashed", label: "- - - Dashed", dash: "6 4" },
  { id: "dotted", label: "····· Dotted", dash: "2 3" },
  { id: "dashdot", label: "-·-·- Dash-dot", dash: "8 3 2 3" },
  { id: "double", label: "════ Double line", dash: "" },
  { id: "thick", label: "━━━━ Thick", dash: "" },
  { id: "wavy", label: "≋≋≋≋ Wavy", dash: "3 3" },
  { id: "chained", label: "▸▸▸▸ Chained", dash: "1 6" },
];

const ARROW_TYPES = [
  { id: "classic", label: "▶ Classic filled", points: "0 0, 10 3.5, 0 7", fill: true },
  { id: "open", label: "▷ Open outline", points: "0 0, 10 3.5, 0 7", fill: false },
  { id: "diamond", label: "◆ Diamond filled", points: "0 3.5, 5 0, 10 3.5, 5 7", fill: true },
  { id: "diamond_open", label: "◇ Diamond open", points: "0 3.5, 5 0, 10 3.5, 5 7", fill: false },
  { id: "circle", label: "● Circle filled", points: "", fill: true },
  { id: "circle_open", label: "○ Circle open", points: "", fill: false },
  { id: "bar", label: "| Bar", points: "0 0, 4 0, 4 7, 0 7", fill: true },
];

const COLORS = ["#E53935","#1E88E5","#43A047","#F4511E","#8E24AA","#6D4C41","#F1D7FF","#F9A825","#00ACC1","#D81B60","#5E35B1","#3949AB","#00897B","#FF7043","#78909C","#7CB342"];

export function RelationModal({ source, target, onConfirm, onCancel, existingEdge }: Props) {
  const proyectoId = useProjectStore((s) => s.project?.id);
  const [types] = useState<RelationType[]>(PRESETS);
  const [relTypeId, setRelTypeId] = useState(existingEdge ? (PRESETS.find(r => r.name === existingEdge.label)?.id ?? "rt6") : "rt6");
  const [direction, setDirection] = useState(existingEdge?.direction ?? "unidirectional");
  const [lineStyle, setLineStyle] = useState(existingEdge?.style ?? "solid");
  const [arrowStyle, setArrowStyle] = useState(existingEdge?.arrowType ?? "classic");
  const [color, setColor] = useState(existingEdge?.color ?? "#F1D7FF");
  const [width, setWidth] = useState(existingEdge?.width ?? 2);
  const [opacity, setOpacity] = useState(existingEdge?.opacity ?? 0.8);
  const [curvature, setCurvature] = useState(existingEdge?.curvature ?? 0);
  const [customLabel, setCustomLabel] = useState(existingEdge?.label ?? "");
  const [labelPos, setLabelPos] = useState(existingEdge?.labelPos ?? "center");
  const [labelBg, setLabelBg] = useState(existingEdge?.labelBg ?? false);
  const [comment, setComment] = useState(existingEdge?.comment ?? "");

  const [showNewRel, setShowNewRel] = useState(false);
  const [newRelName, setNewRelName] = useState("");
  const [newRelShort, setNewRelShort] = useState("");
  const [newRelSymbol, setNewRelSymbol] = useState("");
  const [newRelProp, setNewRelProp] = useState<RelationType["property"]>("undirected");
  const [newRelColor, setNewRelColor] = useState("#F1D7FF");
  const [newRelWidth, setNewRelWidth] = useState(2);

  const selRel = types.find(r => r.id === relTypeId);
  const edgeLabel = customLabel || selRel?.name || "relates to";
  const arrow = ARROW_TYPES.find(a => a.id === arrowStyle) || ARROW_TYPES[0];

  const handleConfirm = () => {
    const edge: NetEdge = {
      id: existingEdge?.id ?? "e-"+Date.now(),
      source: source.id, target: target.id,
      label: edgeLabel, color, width, style: lineStyle,
      direction, arrowType: arrowStyle, opacity, curvature,
      comment, labelPos, labelBg,
    };
    let newRel: RelationType | undefined;
    if (showNewRel && newRelName.trim()) {
      newRel = { id: "rt-"+Date.now(), name: newRelName.trim(), shortName: newRelShort, symbol: newRelSymbol, property: newRelProp, color: newRelColor, width: newRelWidth, style: "solid", editable: true, deletable: true };
      // Persist new relation type to SQLite
      if (proyectoId) {
        execQuery(
          "INSERT INTO tipos_relacion (id, proyecto_id, nombre, nombre_corto, simbolo, dirigida, color_hex, grosor, estilo_linea, punta_flecha) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
          [newRel.id, proyectoId, newRel.name, newRel.shortName, newRel.symbol, newRel.property === "undirected" ? 0 : 1, newRel.color, newRel.width, newRel.style, "classic"]
        ).catch(() => {});
      }
    }
    onConfirm(edge, newRel);
  };

  const pw = 260, ph = 90, mx = pw/2, my = ph/2, sx = 45, sy = my, tx = pw - 45, ty = my;
  const dash = LINE_STYLES.find(l => l.id === lineStyle)?.dash ?? "";

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl w-[520px] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-primary)" }}>
        <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
            {existingEdge ? "✏ Edit" : "🔗 Define"} relation
          </h3>
          <button onClick={onCancel} className="rounded p-1 hover:bg-gray-100"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Source → Target */}
          <div className="flex items-center gap-1 text-[10px] opacity-50">
            <span style={{ color: source.color }}>● {source.label.slice(0, 20)}</span>
            <ArrowRight size={10} />
            <span style={{ color: target.color }}>● {target.label.slice(0, 20)}</span>
          </div>

          {/* Relation type */}
          <div>
            <label className="text-[10px] font-medium opacity-40 uppercase">Type</label>
            <div className="grid grid-cols-2 gap-1 mt-1">
              {types.map(r => (
                <button key={r.id} onClick={() => setRelTypeId(r.id)}
                  className={`text-left px-2 py-1.5 rounded text-[10px] min-touch border ${relTypeId === r.id ? "border-peach-500 bg-peach-50" : "border-transparent hover:bg-gray-50"}`}
                  style={{ borderColor: relTypeId === r.id ? "var(--peach)" : "transparent", color: "var(--text-primary)" }}>
                  <span style={{ color: r.color, fontWeight: 600 }}>{r.symbol} </span>{r.name}
                </button>
              ))}
            </div>
            <button onClick={() => setShowNewRel(!showNewRel)} className="mt-1 text-[10px] flex items-center gap-1 hover:underline" style={{ color: "#000" }}>
              <Plus size={10} /> Create new relation type
            </button>
          </div>

          {/* New relation inline form */}
          {showNewRel && (
            <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: "var(--peach)", backgroundColor: "rgba(241, 215, 255, 0.5)" }}>
              <p className="text-[10px] font-semibold" style={{ color: "#000" }}>✨ New relation</p>
              <div className="grid grid-cols-2 gap-1.5">
                <input value={newRelName} onChange={e => setNewRelName(e.target.value)} placeholder="Full name" className="rounded border px-2 py-1 text-[10px] outline-none" style={{ borderColor: "var(--border)" }} />
                <input value={newRelShort} onChange={e => setNewRelShort(e.target.value)} placeholder="Short name" className="rounded border px-2 py-1 text-[10px] outline-none" style={{ borderColor: "var(--border)" }} />
              </div>
              <div className="flex gap-1.5 items-center">
                <input value={newRelSymbol} onChange={e => setNewRelSymbol(e.target.value)} placeholder="→" className="w-14 rounded border px-2 py-1 text-[10px] text-center outline-none" style={{ borderColor: "var(--border)" }} />
                <select value={newRelProp} onChange={e => setNewRelProp(e.target.value as any)} className="flex-1 rounded border px-1 py-1 text-[9px] outline-none" style={{ borderColor: "var(--border)" }}>
                  <option value="symmetric">Symmetric</option>
                  <option value="asymmetric_transitive">Asym. transitive</option>
                  <option value="asymmetric_nontransitive">Asym. non-trans.</option>
                  <option value="undirected">Undirected</option>
                </select>
                <input type="color" value={newRelColor} onChange={e => setNewRelColor(e.target.value)} className="w-7 h-6 rounded border cursor-pointer" />
                <input type="number" min={1} max={8} value={newRelWidth} onChange={e => setNewRelWidth(parseInt(e.target.value) || 2)} className="w-10 rounded border px-1 py-1 text-[9px] outline-none" style={{ borderColor: "var(--border)" }} />
              </div>
            </div>
          )}

          {/* Direction */}
          <div>
            <label className="text-[10px] font-medium opacity-40 uppercase">Direction</label>
            <div className="flex gap-1 mt-1">
              {[{ id: "unidirectional", label: "A → B", icon: ArrowRight }, { id: "bidirectional", label: "A ↔ B", icon: ArrowLeftRight }, { id: "undirected", label: "A — B", icon: Minus }].map(d => (
                <button key={d.id} onClick={() => setDirection(d.id)}
                  className={`flex items-center gap-1 rounded px-2.5 py-1.5 text-[10px] min-touch border ${direction === d.id ? "border-peach-500 bg-peach-50" : "border-gray-200 hover:bg-gray-50"}`}
                  style={{ color: "var(--text-primary)" }}><d.icon size={12} /> {d.label}</button>
              ))}
            </div>
          </div>

          {/* Line style + Arrow type */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] font-medium opacity-40 uppercase">Line style</label>
              <select value={lineStyle} onChange={e => setLineStyle(e.target.value)}
                className="w-full mt-1 rounded border px-2 py-1.5 text-[10px] outline-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                {LINE_STYLES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-medium opacity-40 uppercase">Arrow tip</label>
              <select value={arrowStyle} onChange={e => setArrowStyle(e.target.value)}
                className="w-full mt-1 rounded border px-2 py-1.5 text-[10px] outline-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                {ARROW_TYPES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>
          </div>

          {/* Color palette */}
          <div>
            <label className="text-[10px] font-medium opacity-40 uppercase">Color</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} className="h-6 w-6 rounded-full border-2 transition-transform"
                  style={{ backgroundColor: c, borderColor: color === c ? "var(--text-primary)" : "transparent", transform: color === c ? "scale(1.3)" : "scale(1)" }} />
              ))}
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-6 w-6 cursor-pointer rounded border" />
            </div>
          </div>

          {/* Width + Opacity + Curvature */}
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-[9px] opacity-30">Width: {width}px</label><input type="range" min={1} max={10} value={width} onChange={e => setWidth(parseInt(e.target.value))} className="w-full" /></div>
            <div><label className="text-[9px] opacity-30">Opacity: {Math.round(opacity * 100)}%</label><input type="range" min={20} max={100} value={opacity * 100} onChange={e => setOpacity(parseInt(e.target.value) / 100)} className="w-full" /></div>
            <div><label className="text-[9px] opacity-30">Curve: {curvature}</label><input type="range" min={0} max={60} value={curvature} onChange={e => setCurvature(parseInt(e.target.value))} className="w-full" /></div>
          </div>

          {/* Custom label */}
          <div>
            <label className="text-[10px] font-medium opacity-40 uppercase">Custom label</label>
            <input value={customLabel} onChange={e => setCustomLabel(e.target.value)} placeholder="Overrides type name" className="w-full mt-1 rounded border px-2 py-1.5 text-[10px] outline-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
            <div className="flex items-center gap-2 mt-1">
              <select value={labelPos} onChange={e => setLabelPos(e.target.value)}
                className="rounded border px-1 py-1 text-[9px] outline-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                <option value="center">Center</option><option value="source">Near source</option><option value="target">Near target</option>
              </select>
              <label className="flex items-center gap-1 text-[10px] cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={labelBg} onChange={() => setLabelBg(!labelBg)} className="size-3" /> White bg
              </label>
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="text-[10px] font-medium opacity-40 uppercase">Comment</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="Notes about this relation..."
              className="w-full mt-1 rounded border px-2 py-1.5 text-[10px] outline-none resize-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
          </div>

          {/* Live preview */}
          <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
            <label className="text-[9px] opacity-30 uppercase flex items-center gap-1 mb-1"><Eye size={10} /> Live preview</label>
            <svg width={pw} height={ph}>
              <defs>
                {direction !== "undirected" && (
                  <marker id="prev-arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    {arrow.id === "circle" || arrow.id === "circle_open" ? <circle cx="5" cy="3.5" r="4" fill={arrow.fill ? color : "none"} stroke={color} strokeWidth={1} />
                    : <polygon points={arrow.points} fill={arrow.fill ? color : "none"} stroke={arrow.fill ? "none" : color} strokeWidth={arrow.fill ? 0 : 1.5} />}
                  </marker>
                )}
                {direction === "bidirectional" && (
                  <marker id="prev-arrow-rev" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                    <polygon points="10 0, 0 3.5, 10 7" fill={color} />
                  </marker>
                )}
              </defs>
              <text x={sx - 8} y={sy - 8} textAnchor="middle" fontSize={8} fill={source.color}>● {source.label.slice(0, 10)}</text>
              <text x={tx + 8} y={ty - 8} textAnchor="middle" fontSize={8} fill={target.color}>● {target.label.slice(0, 10)}</text>
              {lineStyle === "double" ? (
                <>
                  <line x1={sx} y1={sy - 2} x2={tx} y2={ty - 2} stroke={color} strokeWidth={width} opacity={opacity} strokeDasharray={dash} markerEnd={direction !== "undirected" ? "url(#prev-arrow)" : undefined} />
                  <line x1={sx} y1={sy + 2} x2={tx} y2={ty + 2} stroke={color} strokeWidth={width} opacity={opacity} strokeDasharray={dash} />
                </>
              ) : (
                <line x1={sx} y1={sy} x2={tx} y2={ty} stroke={color} strokeWidth={lineStyle === "thick" ? width * 2 : width} opacity={opacity} strokeDasharray={dash}
                  markerEnd={direction !== "undirected" ? "url(#prev-arrow)" : undefined}
                  markerStart={direction === "bidirectional" ? "url(#prev-arrow-rev)" : undefined} />
              )}
              {labelBg && <rect x={mx - edgeLabel.length * 3.5} y={my - 10} width={edgeLabel.length * 7} height={12} rx={3} fill="#fff" opacity={0.85} />}
              <text x={mx} y={labelBg ? my - 2 : my - 6} textAnchor="middle" fontSize={9} fill={color} fontWeight={600}>{edgeLabel.slice(0, 22)}</text>
            </svg>
          </div>
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
          {existingEdge ? (
            <span className="text-[9px] opacity-20">Editing edge</span>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onCancel} className="rounded border px-3 py-1.5 text-[11px] font-medium hover:bg-gray-50 min-touch"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={handleConfirm} className="rounded bg-peach-500 px-4 py-1.5 text-[11px] font-medium text-white hover:bg-peach-700 min-touch">
              {existingEdge ? "Save changes" : "Create relation"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
