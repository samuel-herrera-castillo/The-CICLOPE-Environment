import { useState, useMemo, useEffect } from "react";
import {
  ChevronUp, ChevronDown, Download, Printer,
  X, Tag, FileText,
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { getDistribution } from "../../lib/tauriBridge";

/* ── Types ── */

type DisplayMode = "abs" | "pct-row" | "pct-col" | "norm" | "binary";

interface CellData {
  docId: string;
  docName: string;
  catId: string;
  catName: string;
  catColor: string;
  count: number;
  segments: { id: string; text: string }[];
}

/* ── Helpers ── */

/* ── Components ── */

export function DistributionTable() {
  const documents = useProjectStore((s) => s.documents);
  const categories = useProjectStore((s) => s.categories);
  const proyectoId = useProjectStore((s) => s.project?.id);
  const { toast } = useToast();

  const [mode, setMode] = useState<DisplayMode>("abs");
  const [heatmap, setHeatmap] = useState(false);
  const [minFilter, setMinFilter] = useState(0);
  const [selectedCell, setSelectedCell] = useState<CellData | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [dbRows, setDbRows] = useState<any[]>([]);

  // Fetch real distribution data from SQLite
  useEffect(() => {
    if (!proyectoId) return;
    getDistribution(proyectoId)
      .then((res) => setDbRows(res?.rows || []))
      .catch(() => setDbRows([]));
  }, [proyectoId]);

  // Build cells from real DB data
  const data = useMemo(() => {
    const cells: CellData[] = [];
    dbRows.forEach((row: any) => {
      const catName = row.categoria || "";
      const docName = row.documento || "";
      const count = Number(row.n) || 0;
      if (count === 0) return;
      const cat = categories.find((c) => c.name === catName);
      const doc = documents.find((d) => d.name === docName);
      cells.push({
        docId: doc?.id || docName, docName,
        catId: cat?.id || catName, catName, catColor: cat?.color || "#F1D7FF",
        count,
        segments: Array.from({ length: Math.min(count, 3) }, (_, i) => ({
          id: `seg-${docName}-${catName}-${i}`,
          text: `Segment ${i + 1} coded "${catName}" in "${docName}"`,
        })),
      });
    });
    return cells;
  }, [dbRows, categories, documents]);

  // Matrix: doc × cat
  const matrix = useMemo(() => {
    const m: Record<string, Record<string, CellData>> = {};
    data.forEach((cell) => {
      (m[cell.docId] ??= {})[cell.catId] = cell;
    });
    return m;
  }, [data]);

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const getDisplayValue = (cell: CellData | undefined, docId: string, catId: string): string | number => {
    if (!cell || cell.count < minFilter) return mode === "binary" ? 0 : "—";
    const count = cell.count;
    switch (mode) {
      case "pct-row": {
        const rowTotal = Object.values(matrix[docId] ?? {}).reduce((a, c) => a + c.count, 0);
        return rowTotal > 0 ? `${((count / rowTotal) * 100).toFixed(0)}%` : "0%";
      }
      case "pct-col": {
        let colTotal = 0;
        Object.keys(matrix).forEach((d) => { colTotal += matrix[d]?.[catId]?.count ?? 0; });
        return colTotal > 0 ? `${((count / colTotal) * 100).toFixed(0)}%` : "0%";
      }
      case "norm": return (count / maxCount).toFixed(2);
      case "binary": return count > 0 ? 1 : 0;
      default: return count;
    }
  };

  const getHeatColor = (cell: CellData | undefined): string => {
    if (!heatmap || !cell || cell.count === 0) return "transparent";
    const intensity = Math.min(1, cell.count / maxCount);
    return `rgba(155, 89, 182, ${intensity * 0.35})`; // mauve heatmap
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sortedDocs = useMemo(() => {
    const docs_ = [...documents.slice(0, 6)];
    if (!sortKey) return docs_;
    return docs_.sort((a, b) => {
      const aVal = Object.values(matrix[a.id] ?? {}).reduce((acc, c) => acc + c.count, 0);
      const bVal = Object.values(matrix[b.id] ?? {}).reduce((acc, c) => acc + c.count, 0);
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [documents, matrix, sortKey, sortDir]);

  return (
    <div className="flex h-full" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Config bar */}
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          <span className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Categories × Documents
          </span>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="opacity-30">Mode:</span>
            {(["abs","pct-row","pct-col","norm","binary"] as DisplayMode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`rounded-full px-2.5 py-0.5 font-medium min-touch ${mode === m ? "bg-peach-500 text-white" : "hover:bg-gray-100"}`}
                style={{ color: mode === m ? "#fff" : "var(--text-secondary)" }}>
                {m === "abs" ? "Abs" : m === "pct-row" ? "% Row" : m === "pct-col" ? "% Col" : m === "norm" ? "Norm" : "Bin"}
              </button>
            ))}
          </div>
          <div className="w-px h-5 opacity-20" style={{ backgroundColor: "var(--text-secondary)" }} />
          <label className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={heatmap} onChange={(e) => setHeatmap(e.target.checked)} style={{ accentColor: "var(--peach)" }} /> Heatmap
          </label>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="opacity-30">Min:</span>
            <input type="number" value={minFilter} min={0} max={50} onChange={(e) => setMinFilter(Number(e.target.value))}
              className="w-12 rounded border px-1.5 py-0.5 text-center outline-none"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
          </div>
          <div className="flex-1" />
          <button onClick={() => toast.info("Export", "Exporting to Excel...")}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-secondary)" }}>
            <Download size={12} /> Excel
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-secondary)" }}>
            <Printer size={12} /> Print
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center p-12 text-center">
              <p className="text-sm font-medium opacity-30">Importa documentos y crea categorías primero</p>
              <p className="mt-2 text-xs opacity-20">Los segmentos codificados aparecerán aquí como matriz de distribución.</p>
            </div>
          ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-10 border-r border-b px-3 py-2 text-left font-medium min-w-[140px]"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                  <button onClick={() => handleSort("doc")} className="flex items-center gap-1">
                    Document {sortKey === "doc" && (sortDir === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
                  </button>
                </th>
                {categories.slice(0, 5).map((cat) => (
                  <th key={cat.id}
                    className="sticky top-0 z-10 border-r border-b px-2 py-2 font-medium"
                    style={{
                      borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)",
                      color: cat.color, minWidth: 80, maxWidth: 100,
                    }}>
                    <div style={{
                      transform: "rotate(-45deg)", transformOrigin: "left bottom",
                      whiteSpace: "nowrap", position: "relative", top: 30, left: 6,
                      fontSize: 10, width: 20,
                    }}>
                      {cat.name}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedDocs.map((doc) => (
                <tr key={doc.id} className="border-b hover:bg-gray-50" style={{ borderColor: "var(--border)" }}>
                  <td className="sticky left-0 z-[5] border-r px-3 py-2 font-medium truncate"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}>
                    <FileText size={11} className="inline mr-1 opacity-30" />{doc.name}
                  </td>
                  {categories.slice(0, 5).map((cat) => {
                    const cell = matrix[doc.id]?.[cat.id];
                    const val = getDisplayValue(cell, doc.id, cat.id);
                    return (
                      <td key={cat.id} className="border-r px-3 py-2 text-center cursor-pointer hover:shadow-inner transition-shadow"
                        style={{ borderColor: "var(--border)", backgroundColor: getHeatColor(cell), color: "var(--text-primary)" }}
                        onClick={() => cell && cell.count > 0 && setSelectedCell(cell)}
                        title={cell ? `${cell.docName} × ${cell.catName}: ${cell.count} segments` : undefined}>
                        <span className="font-mono text-[11px]">{val}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>

        {/* Footer stats */}
        <div className="flex items-center gap-4 border-t px-4 py-1.5 text-[10px] opacity-30" style={{ borderColor: "var(--border)" }}>
          <span>{sortedDocs.length} docs × {Math.min(5, categories.length)} categories</span>
          <span>{data.reduce((a, c) => a + c.count, 0)} total segments</span>
        </div>
      </div>

      {/* Side panel — cell detail */}
      {selectedCell && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSelectedCell(null)} />
          <div className="fixed right-0 top-0 z-50 flex h-full w-[300px] flex-col shadow-2xl animate-slide-in"
            style={{ backgroundColor: "var(--bg-panel)", borderLeft: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Cell detail</h3>
                <p className="text-[10px] opacity-40 mt-0.5">
                  <span style={{ color: selectedCell.catColor }}>● {selectedCell.catName}</span>
                  <span className="mx-1">×</span>
                  <span>{selectedCell.docName}</span>
                </p>
              </div>
              <button onClick={() => setSelectedCell(null)} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <p className="mb-3 text-[10px] font-semibold opacity-30">{selectedCell.count} segments</p>
              {selectedCell.segments.map((seg) => (
                <div key={seg.id} className="mb-2 rounded-md border p-2.5" style={{ borderColor: "var(--border)" }}>
                  <p className="text-xs leading-relaxed italic" style={{ color: "var(--text-primary)", fontFamily: "'Lora', Georgia, serif" }}>
                    &ldquo;{seg.text}&rdquo;
                  </p>
                  <div className="mt-1.5 flex items-center gap-1">
                    <button onClick={() => toast.info("Recode", "Select this segment and apply a new category from the Codes panel")}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] hover:bg-gray-100" style={{ color: "var(--text-secondary)" }}>
                      <Tag size={9} /> Recode
                    </button>
                    <button onClick={() => toast.info("Go to doc", "Navigate to this document in the Docs tab")}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] hover:bg-gray-100" style={{ color: "var(--text-secondary)" }}>
                      <FileText size={9} /> Go to doc
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DistributionTable;
