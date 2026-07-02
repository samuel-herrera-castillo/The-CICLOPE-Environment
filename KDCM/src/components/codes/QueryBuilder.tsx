import { useState, useCallback, useRef } from "react";
import { ChevronRight, ChevronDown, GripVertical, X, Plus, Copy, Save, Search, Tag, Play, Pencil, Trash2, Braces } from "lucide-react";
import { useProjectStore, type Category } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { execQuery } from "../../lib/tauriBridge";

/* ── Types ── */

type Operator = "AND" | "OR" | "NOT" | "COOC" | "CONTAINS" | "PROXIMITY";

interface QueryNode {
  id: string;
  type: "category" | "operator" | "group";
  catId?: string;
  catName?: string;
  catColor?: string;
  operator?: Operator;
  proximity?: number;
  children?: QueryNode[];
}

interface SavedQuery {
  id: string; name: string; nodes: QueryNode[];
}

/* ── Operator config ── */

const OPERATORS: { id: Operator; label: string; bg: string; border: string }[] = [
  { id: "AND", label: "AND", bg: "#E3F2FD", border: "#1E88E5" },
  { id: "OR", label: "OR", bg: "#E8F5E9", border: "#43A047" },
  { id: "NOT", label: "NOT", bg: "#FFEBEE", border: "#E53935" },
  { id: "COOC", label: "CO-OCCURS", bg: "#F3E5F5", border: "#8E24AA" },
  { id: "CONTAINS", label: "CONTAINS", bg: "#E0F2F1", border: "#00897B" },
  { id: "PROXIMITY", label: "PROXIMITY", bg: "#FFF8E1", border: "#FF8F00" },
];

/* ══════════════════════════════════════════════════════
   Category tree (draggable)
   ══════════════════════════════════════════════════════ */

function CategoryTree({ onDrag }: { onDrag: (cat: Category) => void }) {
  const categories = useProjectStore((s) => s.categories);
  const roots = categories.filter((c) => !c.parentId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(roots.map((r) => r.id)));

  return (
    <div className="h-full overflow-y-auto py-1">
      {roots.map((root) => (
        <div key={root.id}>
          <div draggable onDragStart={() => onDrag(root)}
            className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing hover:bg-gray-100 active:opacity-50 min-touch"
            style={{ color: "var(--text-primary)", paddingLeft: 12 }}>
            <button onClick={(e) => { e.stopPropagation(); setExpanded((prev) => { const n = new Set(prev); n.has(root.id) ? n.delete(root.id) : n.add(root.id); return n; }); }}
              className="flex-shrink-0 rounded p-0.5">{expanded.has(root.id) ? <ChevronDown size={10} /> : <ChevronRight size={10} />}</button>
            <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: root.color }} />
            <span className="flex-1 truncate">{root.name}</span>
            <GripVertical size={10} className="opacity-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Canvas node rendering
   ══════════════════════════════════════════════════════ */

function NodeChip({ node, onRemove, onUpdate }: {
  node: QueryNode; onRemove: (id: string) => void; onUpdate: (id: string, patch: Partial<QueryNode>) => void;
}) {
  if (node.type === "category") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
        style={{ borderColor: node.catColor ?? "var(--border)", backgroundColor: (node.catColor ?? "#F1D7FF") + "15", color: "var(--text-primary)" }}>
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: node.catColor }} />
        {node.catName}
        <button onClick={() => onRemove(node.id)} className="rounded-full p-0.5 hover:bg-gray-200 opacity-50 hover:opacity-100"><X size={10} /></button>
      </span>
    );
  }

  if (node.type === "operator") {
    const cfg = OPERATORS.find((o) => o.id === node.operator);
    const isNot = node.operator === "NOT";
    return (
      <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold"
        style={{ borderColor: cfg?.border, backgroundColor: cfg?.bg, color: cfg?.border }}>
        {node.operator}
        {isNot && <span className="text-[10px] line-through opacity-50">—</span>}
        {node.operator === "PROXIMITY" && (
          <input type="number" value={node.proximity ?? 1} min={1} max={20}
            onChange={(e) => onUpdate(node.id, { proximity: parseInt(e.target.value) || 1 })}
            onClick={(e) => e.stopPropagation()}
            className="w-10 rounded border bg-white px-1 py-0 text-[10px] text-center outline-none"
            style={{ borderColor: cfg?.border }} />
        )}
        <button onClick={() => onRemove(node.id)} className="rounded-full p-0.5 hover:bg-black/10 opacity-50 hover:opacity-100"><X size={9} /></button>
      </span>
    );
  }

  if (node.type === "group") {
    return (
      <div className="inline-flex flex-col rounded-lg border-2 p-2 gap-1.5" style={{ borderColor: "#9E9E9E", borderStyle: "dashed", borderRadius: 12 }}>
        <span className="text-[9px] font-medium opacity-30 px-1">(group)</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {node.children?.map((child) => (
            <NodeChip key={child.id} node={child} onRemove={(id) => {
              onUpdate(node.id, { children: node.children?.filter((c) => c.id !== id) });
            }} onUpdate={(id, patch) => {
              onUpdate(node.id, { children: node.children?.map((c) => c.id === id ? { ...c, ...patch } : c) });
            }} />
          ))}
          {/* Drop zone inside group */}
          <DropZone onDrop={(cat) => {
            const newNode: QueryNode = { id: `n-${Date.now()}`, type: "category", catId: cat.id, catName: cat.name, catColor: cat.color };
            onUpdate(node.id, { children: [...(node.children ?? []), newNode] });
          }} />
        </div>
        <button onClick={() => onRemove(node.id)} className="self-end rounded p-0.5 hover:bg-gray-200 opacity-30 hover:opacity-100"><X size={10} /></button>
      </div>
    );
  }

  return null;
}

/* ══════════════════════════════════════════════════════
   Drop zone
   ══════════════════════════════════════════════════════ */

function DropZone({ onDrop }: { onDrop: (cat: Category) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); try { const data = JSON.parse(e.dataTransfer.getData("category")); onDrop(data); } catch { /* */ } }}
      className={`inline-flex items-center justify-center rounded-md border border-dashed min-w-[40px] min-h-[28px] transition-colors ${
        over ? "" : ""
      }`}
      style={{ borderColor: over ? "var(--peach)" : "var(--border)", backgroundColor: over ? "var(--peach)" + "15" : "transparent" }}
    >
      <Plus size={12} opacity={over ? 0.6 : 0.2} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   QUERY BUILDER (main)
   ══════════════════════════════════════════════════════ */

export function QueryBuilder() {
  const { toast } = useToast();
  const proyectoId = useProjectStore((s) => s.project?.id);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<QueryNode[]>([]);
  const [results, setResults] = useState<string[]>([]);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [queryName, setQueryName] = useState("");

  // Add category to canvas
  const handleDrop = useCallback((cat: Category) => {
    setNodes((prev) => [...prev, { id: `n-${Date.now()}`, type: "category", catId: cat.id, catName: cat.name, catColor: cat.color }]);
  }, []);

  const handleDrag = useCallback((cat: Category) => {
    // Store category data for drop
    const handler = (e: DragEvent) => { e.dataTransfer?.setData("category", JSON.stringify(cat)); };
    document.addEventListener("dragstart", handler as any, { once: true });
  }, []);

  // Add operator between last two nodes
  const addOperator = (op: Operator) => {
    if (nodes.length < 2) {
      toast.info("Need 2 categories", "Add at least 2 categories before adding an operator");
      return;
    }
    const opNode: QueryNode = { id: `op-${Date.now()}`, type: "operator", operator: op, proximity: op === "PROXIMITY" ? 3 : undefined };
    // Insert operator between last and second-to-last
    const next = [...nodes];
    next.splice(next.length - 1, 0, opNode);
    setNodes(next);
  };

  // Group selected nodes
  const addGroup = () => {
    if (nodes.length < 1) return;
    // Take the last 2-3 nodes and wrap in a group
    const groupNodes = nodes.splice(Math.max(0, nodes.length - 3));
    const group: QueryNode = { id: `grp-${Date.now()}`, type: "group", children: groupNodes };
    setNodes((prev) => [...prev, group]);
  };

  // Remove node
  const removeNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
  };

  // Update node
  const updateNode = (id: string, patch: Partial<QueryNode>) => {
    setNodes((prev) => prev.map((n) => n.id === id ? { ...n, ...patch } : n));
  };

  // Build SQL from node tree and execute
  const buildSQL = (ns: QueryNode[]): { sql: string; params: any[] } => {
    const catNodes = ns.filter((n) => n.type === "category" && n.catId);
    const opNodes = ns.filter((n) => n.type === "operator");

    if (catNodes.length === 0) return { sql: "", params: [] };

    // Detect operators types
    const hasOR = opNodes.some((n) => n.operator === "OR");
    const hasNOT = opNodes.some((n) => n.operator === "NOT");
    const hasCOOC = opNodes.some((n) => n.operator === "COOC");

    let sql = "";
    let params: any[] = [];

    if (hasOR && catNodes.length >= 2) {
      // UNION of SELECTs
      const selects = catNodes.map((cat) => {
        params.push(cat.catId!);
        return `SELECT DISTINCT ci.id, ci.texto_seleccionado, d.nombre as doc FROM citas ci JOIN citas_codigos cc ON ci.id=cc.cita_id JOIN documentos d ON ci.documento_id=d.id WHERE cc.codigo_id=?${params.length}`;
      });
      sql = selects.join(" UNION ");
      sql += " LIMIT 20";
    } else if (hasNOT && catNodes.length >= 2) {
      // EXCEPT: first category MINUS second
      const firstCat = catNodes[0];
      const secondCat = catNodes[1];
      params.push(firstCat.catId!, secondCat.catId!);
      sql = `SELECT DISTINCT ci.id, ci.texto_seleccionado, d.nombre as doc FROM citas ci JOIN citas_codigos cc ON ci.id=cc.cita_id JOIN documentos d ON ci.documento_id=d.id WHERE cc.codigo_id=?1 EXCEPT SELECT DISTINCT ci.id, ci.texto_seleccionado, d.nombre as doc FROM citas ci JOIN citas_codigos cc ON ci.id=cc.cita_id JOIN documentos d ON ci.documento_id=d.id WHERE cc.codigo_id=?2 LIMIT 20`;
    } else if (hasCOOC && catNodes.length >= 2) {
      // Co-occurrence: self-join on same cita
      const ids = catNodes.map((c) => c.catId!);
      params.push(...ids);
      sql = `SELECT DISTINCT ci.id, ci.texto_seleccionado, d.nombre as doc FROM citas ci JOIN citas_codigos cc1 ON ci.id=cc1.cita_id JOIN citas_codigos cc2 ON ci.id=cc2.cita_id JOIN documentos d ON ci.documento_id=d.id WHERE cc1.codigo_id=?1 AND cc2.codigo_id=?2 AND cc1.codigo_id < cc2.codigo_id LIMIT 20`;
    } else {
      // Default AND / single category
      const catIds = catNodes.map((n) => n.catId!);
      params.push(...catIds);
      sql = `SELECT DISTINCT ci.id, ci.texto_seleccionado, d.nombre as doc FROM citas ci JOIN citas_codigos cc ON ci.id=cc.cita_id JOIN documentos d ON ci.documento_id=d.id WHERE cc.codigo_id IN (${catIds.map(() => "?").join(",")}) LIMIT 20`;
    }

    return { sql, params };
  };

  const executeQuery = async () => {
    if (nodes.length === 0) { toast.info("Empty query", "Add categories or operators to the canvas"); return; }
    if (!proyectoId) { toast.info("No project", "Open a project first"); return; }
    try {
      const { sql, params } = buildSQL(nodes);
      if (!sql) { setResults([]); toast.info("No results", "Add categories to the query"); return; }
      const res = await execQuery(sql, params);
      const rows = res?.rows || [];
      setResults(rows.map((r: any) => (r.texto_seleccionado || r[1] || "").slice(0, 120)));
      toast.success("Query executed", `${rows.length} segments match`);
    } catch { toast.error("Error", "Could not execute query"); setResults([]); }
  };

  // Export logic as text
  const exportLogic = () => {
    const text = nodes.map((n) => {
      if (n.type === "category") return n.catName ?? "?";
      if (n.type === "operator") return n.operator === "PROXIMITY" ? `WITHIN ${n.proximity ?? 3} PARAGRAPHS OF` : n.operator;
      if (n.type === "group") return `(${n.children?.map((c) => c.catName ?? c.operator ?? "?").join(" ") ?? ""})`;
      return "?";
    }).join(" ");
    navigator.clipboard.writeText(text).then(() => toast.success("Copied", "Query logic copied to clipboard"));
  };

  // Save query
  const saveQuery = () => {
    if (!queryName.trim()) { toast.info("Name required", "Enter a name for this query"); return; }
    setSavedQueries((prev) => [...prev, { id: `q-${Date.now()}`, name: queryName.trim(), nodes: [...nodes] }]);
    setQueryName("");
    toast.success("Saved", `Query "${queryName.trim()}" saved`);
  };

  return (
    <div className="flex h-full" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Left: Category tree */}
      <div className="w-[220px] flex-shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <div className="border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
          <span className="text-[10px] font-semibold uppercase opacity-30" style={{ color: "var(--text-secondary)" }}>Categories</span>
          <p className="text-[9px] opacity-20 mt-0.5">Drag to canvas</p>
        </div>
        <CategoryTree onDrag={handleDrag} />
      </div>

      {/* Center: Canvas */}
      <div className="flex flex-1 flex-col">
        {/* Operator toolbar */}
        <div className="flex items-center gap-1 border-b px-3 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          <span className="text-[10px] font-semibold opacity-30 mr-2">Operators:</span>
          {OPERATORS.map((op) => (
            <button key={op.id} onClick={() => addOperator(op.id)}
              className="rounded-full border px-2.5 py-1 text-[10px] font-bold hover:opacity-80 min-touch"
              style={{ borderColor: op.border, backgroundColor: op.bg, color: op.border }}>
              {op.label}
            </button>
          ))}
          <div className="w-px h-5 opacity-20 mx-1" style={{ backgroundColor: "var(--text-secondary)" }} />
          <button onClick={addGroup}
            className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium hover:bg-gray-50 min-touch"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <Braces size={11} /> Group
          </button>
          <button onClick={() => setNodes([])}
            className="rounded p-1 hover:bg-gray-100 min-touch opacity-40 hover:opacity-80" title="Clear all">
            <Trash2 size={13} />
          </button>
          <div className="flex-1" />
          <button onClick={exportLogic}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-secondary)" }}>
            <Copy size={11} /> Copy logic
          </button>
        </div>

        {/* Drop canvas */}
        <div ref={canvasRef}
          className="flex-1 overflow-auto p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            try { const cat = JSON.parse(e.dataTransfer.getData("category")); handleDrop(cat); } catch { /* */ }
          }}
          style={{ minHeight: 200 }}
        >
          {nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed" style={{ borderColor: "var(--border)" }}>
                  <Plus size={24} opacity={0.2} />
                </div>
                <p className="text-xs opacity-25">Drag categories from the left panel</p>
                <p className="text-[10px] opacity-15 mt-0.5">Then add operators between them</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {nodes.map((node) => (
                <NodeChip key={node.id} node={node} onRemove={removeNode} onUpdate={updateNode} />
              ))}
              <DropZone onDrop={handleDrop} />
            </div>
          )}
        </div>

        {/* Save bar */}
        <div className="flex items-center gap-2 border-t px-4 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          <input value={queryName} onChange={(e) => setQueryName(e.target.value)} placeholder="Query name..."
            className="rounded border px-2.5 py-1.5 text-xs outline-none w-[180px]"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
          <button onClick={saveQuery}
            className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs min-touch hover:bg-gray-50"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}><Save size={12} /> Save</button>
          <div className="flex-1" />
          <button onClick={executeQuery}
            className="flex items-center gap-1.5 rounded-md bg-peach-500 px-4 py-2 text-xs font-medium text-white hover:bg-peach-700 min-touch">
            <Search size={13} /> Execute
          </button>
        </div>
      </div>

      {/* Right: Results + saved queries */}
      <div className="w-[280px] flex-shrink-0 border-l flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        {/* Results */}
        {results.length > 0 && (
          <div className="border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[10px] font-semibold" style={{ color: "var(--text-secondary)" }}>{results.length} segments</span>
              <button onClick={() => toast.info("Code all", "Select a category from the left panel to apply to all query results")}
                className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium bg-peach-500 text-white hover:bg-peach-700 min-touch">
                <Tag size={10} /> Code all
              </button>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className="border-b px-3 py-1.5 text-[10px]" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>{r}</div>
              ))}
            </div>
          </div>
        )}

        {/* Saved queries */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
            <span className="text-[10px] font-semibold uppercase opacity-30" style={{ color: "var(--text-secondary)" }}>Saved queries</span>
          </div>
          {savedQueries.length === 0 ? (
            <p className="px-3 py-4 text-[10px] opacity-20 text-center">No saved queries</p>
          ) : (
            savedQueries.map((q) => (
              <div key={q.id} className="flex items-center gap-1 border-b px-3 py-1.5 text-xs" style={{ borderColor: "var(--border)" }}>
                <span className="flex-1 truncate font-medium" style={{ color: "var(--text-primary)" }}>{q.name}</span>
                <button onClick={() => { setNodes([...q.nodes]); executeQuery(); }}
                  className="rounded p-0.5 hover:bg-gray-100" title="Execute"><Play size={10} /></button>
                <button onClick={() => { const n = prompt("Rename query:", q.name); if (n) setSavedQueries((prev) => prev.map((s) => s.id === q.id ? { ...s, name: n } : s)); }}
                  className="rounded p-0.5 hover:bg-gray-100" title="Rename"><Pencil size={10} /></button>
                <button onClick={() => setSavedQueries((prev) => prev.filter((s) => s.id !== q.id))}
                  className="rounded p-0.5 hover:bg-gray-100 text-red-400" title="Delete"><Trash2 size={10} /></button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default QueryBuilder;
