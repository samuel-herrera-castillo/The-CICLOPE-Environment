import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Pencil, BookOpen, GitBranch, FileText,
  Hash, Link, Plus, Eye, Trash2,
} from "lucide-react";
import type { Category, CategoryRelation } from "../../stores/projectStore";
import { useProjectStore } from "../../stores/projectStore";
import { useCollabStore } from "../../stores/collabStore";
import { useToast } from "../../stores/toastStore";
import { execQuery } from "../../lib/tauriBridge";
import * as d3 from "d3";

/* ══════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════ */

type Tab = "definition" | "segments" | "distribution" | "relations";

const TAB_LIST: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "definition", label: "Definition", icon: FileText },
  { id: "segments", label: "Segments", icon: Hash },
  { id: "distribution", label: "Distribution", icon: GitBranch },
  { id: "relations", label: "Relations", icon: Link },
];

interface Props {
  open: boolean;
  category: Category | null;
  initialTab?: Tab;
  onClose: () => void;
}

/* ── Mock segment data for the Segments tab ── */
interface CodedSegment {
  id: string;
  text: string;
  docName: string;
  authorName: string;
  authorColor: string;
  date: string;
}

/* ── Mock distribution data ── */
interface DistributionItem {
  docName: string;
  count: number;
}

/* ══════════════════════════════════════════════════════
   Distribution Bar Chart (D3)
   ══════════════════════════════════════════════════════ */

function DistributionChart({ data }: { data: DistributionItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const h = 200;

  useEffect(() => {
    if (!ref.current || data.length === 0) return;
    ref.current.innerHTML = "";

    const container = ref.current;
    const w = container.clientWidth;
    const margin = { top: 8, right: 24, bottom: 24, left: 100 };
    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    const svg = d3.select(container)
      .append("svg")
      .attr("width", w)
      .attr("height", h);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain([0, d3.max(data, (d) => d.count) ?? 0])
      .range([0, innerW])
      .nice();

    const y = d3.scaleBand()
      .domain(data.map((d) => d.docName))
      .range([0, innerH])
      .padding(0.25);

    const barColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--peach").trim() || "#F1D7FF";

    // Axes
    g.append("g")
      .call(d3.axisLeft(y).tickSize(0).tickPadding(6))
      .attr("font-size", 10)
      .attr("color", "var(--text-secondary)")
      .selectAll(".tick text")
      .style("fill", "var(--text-secondary)");

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(4).tickSize(4))
      .attr("font-size", 10)
      .attr("color", "var(--text-secondary)")
      .selectAll(".tick text")
      .style("fill", "var(--text-secondary)");

    // Remove domain lines
    g.selectAll(".domain").remove();

    // Bars
    g.selectAll("rect")
      .data(data)
      .join("rect")
      .attr("y", (d) => y(d.docName) ?? 0)
      .attr("height", y.bandwidth())
      .attr("x", 0)
      .attr("width", (d) => x(d.count))
      .attr("fill", barColor)
      .attr("opacity", 0.75)
      .attr("rx", 2)
      .append("title")
      .text((d) => `${d.docName}: ${d.count} segments`);

    // Value labels
    g.selectAll(".val")
      .data(data)
      .join("text")
      .attr("class", "val")
      .attr("x", (d) => x(d.count) + 4)
      .attr("y", (d) => (y(d.docName) ?? 0) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("font-size", 10)
      .attr("font-weight", 500)
      .attr("fill", "var(--text-secondary)")
      .text((d) => d.count);
  }, [data]);

  return <div ref={ref} style={{ width: "100%", height: h, minHeight: h }} />;
}

/* ══════════════════════════════════════════════════════
   CategoryInspector
   ══════════════════════════════════════════════════════ */

export function CategoryInspector({ open, category, initialTab, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("definition");
  const { toast } = useToast();
  const updateCategory = useProjectStore((s) => s.updateCategory);
  const collabSession = useCollabStore((s) => s.session);
  const collabParticipants = collabSession?.participants.filter((p) => p.online) ?? [];

  // ── Inline editable fields ──
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [codingRule, setCodingRule] = useState("");
  const [exampleCitation, setExampleCitation] = useState("");
  const [color, setColor] = useState("#F1D7FF");
  const [hasChanges, setHasChanges] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Collaboration warning ──
  const [collabWarning, setCollabWarning] = useState<string | null>(null);

  // ── Relations local state ──
  const [relations, setRelations] = useState<CategoryRelation[]>([]);
  const [addingRelation, setAddingRelation] = useState(false);
  const [newRelLabel, setNewRelLabel] = useState("");
  const [newRelTarget, setNewRelTarget] = useState("");

  const allCategories = useProjectStore((s) => s.categories);

  // ── Sync state from category prop ──
  useEffect(() => {
    if (!open || !category) return;
    setName(category.name);
    setDescription(category.description ?? "");
    setCodingRule(category.coding_rule ?? "");
    setExampleCitation(category.example_citation ?? "");
    setColor(category.color);
    setHasChanges(false);
    setRelations(category.relations ?? []);
    setTab(initialTab ?? "definition");
    setCollabWarning(null);
  }, [open, category]);

  // ── Autosave with 1.5s debounce ──
  const scheduleAutosave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (!category || !hasChanges) return;
      updateCategory(category.id, {
        name,
        description,
        coding_rule: codingRule,
        example_citation: exampleCitation,
        color,
        relations,
      });
      setHasChanges(false);
      toast.success("Saved", "Category changes auto-saved");
    }, 1500);
  }, [category, hasChanges, name, description, codingRule, exampleCitation, color, relations, updateCategory, toast]);

  useEffect(() => {
    if (hasChanges) scheduleAutosave();
  }, [hasChanges, scheduleAutosave]);

  // Cleanup autosave on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        // Flush pending changes
        if (category && hasChanges) {
          updateCategory(category.id, {
            name, description, coding_rule: codingRule,
            example_citation: exampleCitation, color, relations,
          });
        }
      }
    };
  }, []);

  // ── Simulate collaboration detection ──
  useEffect(() => {
    if (!open || !category || collabParticipants.length < 2) return;
    // Simulate: if >1 participant online, show warning
    const other = collabParticipants.find((p) => p.name !== "You");
    if (other) {
      setCollabWarning(other.name);
      const t = setTimeout(() => setCollabWarning(null), 8000);
      return () => clearTimeout(t);
    }
  }, [open, category, collabParticipants]);

  // ── Real segments from SQLite ──
  const [segments, setSegments] = useState<CodedSegment[]>([]);
  const [distributionData, setDistributionData] = useState<DistributionItem[]>([]);

  useEffect(() => {
    if (!category?.id) return;
    (async () => {
      try {
        const r = await execQuery(
          `SELECT c.id, c.texto_seleccionado, c.fecha_creacion, d.nombre as doc, i.nombre as inv, i.color_presencia_hex as inv_color
           FROM citas c JOIN citas_codigos cc ON cc.cita_id=c.id
           JOIN documentos d ON c.documento_id=d.id
           LEFT JOIN investigadores i ON c.investigador_id=i.id
           WHERE cc.codigo_id=?1 ORDER BY cc.peso_codificacion DESC LIMIT 20`,
          [category.id]
        );
        setSegments((r.rows || []).map((row: any) => ({
          id: row.id || "",
          text: `"${(row.texto_seleccionado || "").slice(0, 150)}"`,
          docName: row.doc || "Unknown",
          authorName: row.inv || "Unknown",
          authorColor: row.inv_color || "#9b59b6",
          date: row.fecha_creacion ? new Date(row.fecha_creacion).toLocaleDateString() : "",
        })));
      } catch { setSegments([]); }
      try {
        const r = await execQuery(
          `SELECT d.nombre as doc, COUNT(*) as cnt
           FROM citas c JOIN citas_codigos cc ON cc.cita_id=c.id
           JOIN documentos d ON c.documento_id=d.id
           WHERE cc.codigo_id=?1 GROUP BY d.id ORDER BY cnt DESC`,
          [category.id]
        );
        setDistributionData((r.rows || []).map((row: any) => ({
          docName: row.doc || "Unknown",
          count: parseInt(row.cnt || "0"),
        })));
      } catch { setDistributionData([]); }
    })();
  }, [category?.id]);

  if (!open || !category) return null;

  // ── Derived metrics ──
  const rooting = category.rooting ?? 0;
  const density = category.density ?? 0;
  const docCount = category.documentCount ?? 0;
  const researcherCount = category.researcherCount ?? 0;

  const handleAddRelation = () => {
    if (!newRelLabel.trim() || !newRelTarget) return;
    const target = allCategories.find((c) => c.id === newRelTarget);
    if (!target) return;
    const rel: CategoryRelation = {
      id: `rel-${Date.now()}`,
      label: newRelLabel.trim(),
      targetCategoryId: target.id,
      targetCategoryName: target.name,
      targetCategoryColor: target.color,
      type: "custom",
    };
    const next = [...relations, rel];
    setRelations(next);
    setHasChanges(true);
    setNewRelLabel("");
    setNewRelTarget("");
    setAddingRelation(false);
    toast.success("Relation added", `→ ${target.name}`);
  };

  const handleRemoveRelation = (relId: string) => {
    setRelations((prev) => prev.filter((r) => r.id !== relId));
    setHasChanges(true);
    toast.success("Removed", "Relation deleted");
  };

  const handleFieldChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(e.target.value);
    setHasChanges(true);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[300]" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed right-4 top-4 z-[310] flex max-h-[calc(100vh-48px)] w-[380px] flex-col overflow-hidden shadow-xl"
        style={{
          backgroundColor: "var(--bg-panel)",
          borderRadius: 12,
          borderTop: `3px solid ${category.color}`,
          borderLeft: "1px solid var(--border)",
          borderRight: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* ═══ Header ═══ */}
        <div className="flex-shrink-0 px-4 pt-4 pb-3">
          {/* Collab warning */}
          {collabWarning && (
            <div
              className="mb-3 flex items-start gap-2 rounded-md px-3 py-2 text-xs animate-pulse"
              style={{ backgroundColor: "rgba(241, 215, 255, 0.5)", color: "#C4A0D4", border: "1px solid rgba(241, 215, 255, 0.7)" }}
            >
              <span className="mt-0.5">⚠</span>
              <span><strong>{collabWarning}</strong> is also editing this category. Last change wins.</span>
            </div>
          )}

          {/* Name + color dot */}
          <div className="flex items-center gap-2.5 mb-3">
            <span
              className="inline-block flex-shrink-0 rounded-full"
              style={{ width: 20, height: 20, backgroundColor: category.color }}
            />
            <h2
              className="flex-1 text-lg font-bold truncate min-w-0"
              style={{ color: "var(--text-primary)" }}
            >
              {category.name}
            </h2>
          </div>

          {/* Metrics 2×2 grid */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[
              { label: "Rooting", value: rooting, unit: "" },
              { label: "Density", value: density, unit: "" },
              { label: "In docs", value: docCount, unit: "" },
              { label: "Researchers", value: researcherCount, unit: "" },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-md px-3 py-2"
                style={{ backgroundColor: "var(--bg-secondary)" }}
              >
                <div className="text-[10px] font-medium uppercase tracking-wider opacity-40" style={{ color: "var(--text-secondary)" }}>
                  {m.label}
                </div>
                <div className="text-2xl font-semibold" style={{ color: "#000" }}>
                  {m.value}{m.unit}
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                // Switch to definition tab for editing
                setTab("definition");
              }}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium hover:bg-gray-100 min-touch"
              style={{ color: "var(--text-primary)" }}
              title="Edit"
            >
              <Pencil size={13} /> Edit
            </button>
            <button
              onClick={() => toast.info("Citations", `Reading all citations coded with "${category.name}"`)}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium hover:bg-gray-100 min-touch"
              style={{ color: "var(--text-secondary)" }}
              title="Read citations"
            >
              <BookOpen size={13} /> Cite
            </button>
            <button
              onClick={() => toast.info("Network", `Showing network for "${category.name}"`)}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium hover:bg-gray-100 min-touch"
              style={{ color: "var(--text-secondary)" }}
              title="View in network"
            >
              <GitBranch size={13} /> Network
            </button>
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="rounded-md p-1.5 hover:bg-gray-100 min-touch"
              style={{ color: "var(--text-secondary)" }}
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ═══ Tabs ═══ */}
        <div
          className="flex flex-shrink-0 items-center justify-center border-b"
          style={{ borderColor: "var(--border)" }}
          role="tablist"
        >
          {TAB_LIST.map((t, i) => {
            const Icon = t.icon;
            return (
              <div key={t.id} className="flex items-center">
                {i > 0 && <div className="mx-1 h-4 w-px" style={{ backgroundColor: "var(--border)" }} />}
                <button
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center justify-center gap-1 px-3 py-2 text-[13px] font-medium transition-colors min-touch ${
                    tab === t.id ? "" : "opacity-50 hover:opacity-80"
                  }`}
                  style={{
                    color: "#000",
                    borderBottom: tab === t.id ? "2px solid var(--peach)" : "2px solid transparent",
                  }}
                >
                  <Icon size={12} /> {t.label}
                </button>
              </div>
            );
          })}
        </div>

        {/* ═══ Tab Content ═══ */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* ── Definition tab ── */}
          {tab === "definition" && (
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider opacity-40" style={{ color: "var(--text-secondary)" }}>
                  Name <span className="opacity-40 font-normal">{name.length}/120</span>
                </label>
                <input
                  value={name}
                  onChange={handleFieldChange(setName)}
                  maxLength={120}
                  className="w-full rounded-md border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider opacity-40" style={{ color: "var(--text-secondary)" }}>
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={handleFieldChange(setDescription)}
                  rows={3}
                  className="w-full resize-none rounded-md border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
                />
              </div>

              {/* Coding rule */}
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider opacity-40" style={{ color: "var(--text-secondary)" }}>
                  Coding rule
                </label>
                <input
                  value={codingRule}
                  onChange={handleFieldChange(setCodingRule)}
                  placeholder="e.g. 'Must include a value judgment about the policy'"
                  className="w-full rounded-md border px-3 py-2 text-xs outline-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
                />
              </div>

              {/* Example citation */}
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider opacity-40" style={{ color: "var(--text-secondary)" }}>
                  Example citation
                </label>
                <input
                  value={exampleCitation}
                  onChange={handleFieldChange(setExampleCitation)}
                  placeholder="A short example segment that fits this code"
                  className="w-full rounded-md border px-3 py-2 text-xs outline-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
                />
              </div>

              {/* Color */}
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider opacity-40" style={{ color: "var(--text-secondary)" }}>
                  Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => { setColor(e.target.value); setHasChanges(true); }}
                    className="h-8 w-10 cursor-pointer rounded border"
                    style={{ borderColor: "var(--border)" }}
                  />
                  <span className="text-xs opacity-40" style={{ color: "var(--text-secondary)" }}>{color}</span>
                </div>
              </div>

              {/* Saved indicator */}
              <div className="flex items-center gap-1.5 text-[10px] opacity-40" style={{ color: "var(--text-secondary)" }}>
                {hasChanges ? (
                  <span className="inline-flex items-center gap-1" style={{ color: "#000" }}>
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--peach)", animation: "pulse 1.5s ease-in-out infinite" }} />
                    Unsaved changes...
                  </span>
                ) : (
                  <span>✓ All changes saved</span>
                )}
              </div>
            </div>
          )}

          {/* ── Segments tab ── */}
          {tab === "segments" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium uppercase tracking-wider opacity-40" style={{ color: "var(--text-secondary)" }}>
                  Coded segments ({segments.length})
                </span>
              </div>
              {segments.length === 0 ? (
                <p className="py-6 text-center text-xs opacity-30" style={{ color: "var(--text-secondary)" }}>
                  No segments coded with this category yet.
                </p>
              ) : (
                segments.map((seg) => (
                  <div
                    key={seg.id}
                    className="rounded-md border p-3 cursor-pointer hover:shadow-sm transition-shadow"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <p
                      className="mb-2 text-xs leading-relaxed italic"
                      style={{
                        fontFamily: "'Lora', Georgia, serif",
                        color: "var(--text-primary)",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {seg.text}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] opacity-50" style={{ color: "var(--text-secondary)" }}>
                      <FileText size={11} />
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>{seg.docName}</span>
                      <span>·</span>
                      <span
                        className="inline-flex items-center gap-1"
                        title={seg.authorName}
                      >
                        <span
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white"
                          style={{ backgroundColor: seg.authorColor }}
                        >
                          {seg.authorName.charAt(0)}
                        </span>
                        {seg.authorName}
                      </span>
                      <span>·</span>
                      <span>{seg.date}</span>
                    </div>
                  </div>
                ))
              )}
              <button onClick={() => toast.info("Citation Reader", "Open Analysis tab → Reader to see all citations for this category")}
                className="flex w-full items-center justify-center gap-1 rounded-md border py-2 text-xs font-medium hover:bg-gray-50 min-touch"
                style={{ borderColor: "var(--border)", color: "#000" }}>
                <Eye size={12} /> View all citations in reader
              </button>
            </div>
          )}

          {/* ── Distribution tab ── */}
          {tab === "distribution" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider opacity-40" style={{ color: "var(--text-secondary)" }}>
                  Segments per document
                </span>
                <span className="text-[10px] opacity-30" style={{ color: "var(--text-secondary)" }}>
                  {distributionData.length} docs
                </span>
              </div>

              <div className="rounded-md border p-2" style={{ borderColor: "var(--border)" }}>
                <DistributionChart data={distributionData} />
              </div>

              {/* Summary table */}
              <div className="rounded-md border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: "var(--bg-secondary)" }}>
                      <th className="px-3 py-2 text-left font-medium opacity-40" style={{ color: "var(--text-secondary)" }}>Document</th>
                      <th className="px-3 py-2 text-right font-medium opacity-40" style={{ color: "var(--text-secondary)" }}>Segments</th>
                      <th className="px-3 py-2 text-right font-medium opacity-40" style={{ color: "var(--text-secondary)" }}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributionData.map((d) => {
                      const total = distributionData.reduce((acc, x) => acc + x.count, 0);
                      const pct = total > 0 ? ((d.count / total) * 100).toFixed(0) : "0";
                      return (
                        <tr key={d.docName} className="border-t" style={{ borderColor: "var(--border)" }}>
                          <td className="px-3 py-2 font-medium" style={{ color: "var(--text-primary)" }}>{d.docName}</td>
                          <td className="px-3 py-2 text-right font-mono" style={{ color: "#000" }}>{d.count}</td>
                          <td className="px-3 py-2 text-right opacity-50">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Relations tab ── */}
          {tab === "relations" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium uppercase tracking-wider opacity-40" style={{ color: "var(--text-secondary)" }}>
                  Formal relations ({relations.length})
                </span>
                <button
                  onClick={() => setAddingRelation(true)}
                  className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium hover:bg-gray-100 min-touch"
                  style={{ color: "#000" }}
                >
                  <Plus size={12} /> Add
                </button>
              </div>

              {/* Add relation form */}
              {addingRelation && (
                <div className="rounded-md border p-3 space-y-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
                  <label className="block text-[10px] font-medium uppercase tracking-wider opacity-40" style={{ color: "var(--text-secondary)" }}>
                    Relation label
                  </label>
                  <input
                    value={newRelLabel}
                    onChange={(e) => setNewRelLabel(e.target.value)}
                    placeholder="e.g. 'contradicts', 'supports', 'causes'"
                    className="w-full rounded-md border px-3 py-1.5 text-xs outline-none"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
                    autoFocus
                  />
                  <label className="block text-[10px] font-medium uppercase tracking-wider opacity-40" style={{ color: "var(--text-secondary)" }}>
                    Target category
                  </label>
                  <select
                    value={newRelTarget}
                    onChange={(e) => setNewRelTarget(e.target.value)}
                    className="w-full rounded-md border bg-transparent px-3 py-1.5 text-xs outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="">— Select —</option>
                    {allCategories
                      .filter((c) => c.id !== category.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => { setAddingRelation(false); setNewRelLabel(""); setNewRelTarget(""); }}
                      className="rounded-md border px-3 py-1.5 text-[11px] min-touch"
                      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddRelation}
                      disabled={!newRelLabel.trim() || !newRelTarget}
                      className="rounded-md bg-peach-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-peach-700 disabled:opacity-40 min-touch"
                    >
                      Add relation
                    </button>
                  </div>
                </div>
              )}

              {/* Relations list */}
              {relations.length === 0 && !addingRelation ? (
                <p className="py-6 text-center text-xs opacity-30" style={{ color: "var(--text-secondary)" }}>
                  No formal relations defined yet.
                </p>
              ) : (
                relations.map((rel) => (
                  <div
                    key={rel.id}
                    className="flex items-center gap-2.5 rounded-md border p-2.5"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: rel.targetCategoryColor }}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                        {rel.label}
                      </span>
                      <span className="mx-1.5 text-[10px] opacity-30">→</span>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {rel.targetCategoryName}
                      </span>
                    </div>
                    <button
                      onClick={() => toast.info("Network", `Showing network for "${category.name}"`)}
                      className="flex-shrink-0 rounded p-1 hover:bg-gray-100 opacity-40 hover:opacity-80"
                      title="View in network explorer"
                    >
                      <GitBranch size={13} />
                    </button>
                    <button
                      onClick={() => handleRemoveRelation(rel.id)}
                      className="flex-shrink-0 rounded p-1 hover:bg-red-50 opacity-30 hover:opacity-80"
                      style={{ color: "#F44336" }}
                      title="Remove relation"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default CategoryInspector;
