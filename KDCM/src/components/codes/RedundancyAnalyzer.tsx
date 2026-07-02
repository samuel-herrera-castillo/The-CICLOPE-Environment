import { useState } from "react";
import { Search, Play, Download, GitMerge, Scissors, Check } from "lucide-react";
import { useToast } from "../../stores/toastStore";
import { useProjectStore } from "../../stores/projectStore";
import { getCitations } from "../../lib/tauriBridge";

/* ── Types ── */

type RedundancyType = "duplicate" | "contained" | "overlapping";

interface Redundancy {
  id: string; type: RedundancyType;
  textA: string; textB: string; docA: string; docB: string;
  resolved: boolean;
}

const TYPE_LABELS: Record<RedundancyType, { label: string; color: string; icon: string }> = {
  duplicate: { label: "Duplicate citations", color: "#F44336", icon: "📋" },
  contained: { label: "Contained citations", color: "#F1D7FF", icon: "📦" },
  overlapping: { label: "Overlapping citations", color: "#2196F3", icon: "🔀" },
};

// Simple Levenshtein distance for similarity detection
function levenshtein(a: string, b: string): number {
  const m = Math.min(a.length, 100), n = Math.min(b.length, 100);
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

/* ── Main ── */

export function RedundancyAnalyzer() {
  const proyectoId = useProjectStore((s) => s.project?.id);
  const [results, setResults] = useState<Redundancy[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filter, setFilter] = useState<RedundancyType | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const runAnalysis = async () => {
    if (!proyectoId) { toast.info("No project", "Open a project first"); return; }
    setAnalyzing(true); setProgress(0);
    try {
      const res = await getCitations(proyectoId);
      const rows = res?.rows || [];
      const found: Redundancy[] = [];
      let idCounter = 0;
      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          const textA = (rows[i].texto || rows[i].texto_seleccionado || "").slice(0, 200);
          const textB = (rows[j].texto || rows[j].texto_seleccionado || "").slice(0, 200);
          if (!textA || !textB) continue;
          const dist = levenshtein(textA, textB);
          const maxLen = Math.max(textA.length, textB.length);
          const similarity = 1 - dist / maxLen;
          if (similarity > 0.9) {
            found.push({
              id: `red-${++idCounter}`,
              type: "duplicate",
              textA: textA.slice(0, 80),
              textB: textB.slice(0, 80),
              docA: rows[i].doc || rows[i].doc_nombre || "",
              docB: rows[j].doc || rows[j].doc_nombre || "",
              resolved: false,
            });
          } else if (textA.includes(textB.slice(0, 40)) || textB.includes(textA.slice(0, 40))) {
            found.push({
              id: `red-${++idCounter}`,
              type: "contained",
              textA: textA.slice(0, 80),
              textB: textB.slice(0, 80),
              docA: rows[i].doc || rows[i].doc_nombre || "",
              docB: rows[j].doc || rows[j].doc_nombre || "",
              resolved: false,
            });
          }
        }
        setProgress(Math.round(((i + 1) / rows.length) * 100));
        if (found.length > 50) break; // Limit results
        await new Promise((r) => setTimeout(r, 0)); // Allow UI to update
      }
      setResults(found.slice(0, 50));
      toast.success("Analysis complete", `${found.length} potential redundancies found`);
    } catch { toast.error("Error", "Could not analyze redundancies"); setResults([]); }
    setAnalyzing(false);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const mergeAll = () => {
    setResults((prev) => prev.map((r) => selected.has(r.id) ? { ...r, resolved: true } : r));
    setSelected(new Set());
    toast.success("Merged", `${selected.size} redundancies merged`);
  };

  const resolveAction = (id: string, action: string) => {
    setResults((prev) => prev.map((r) => r.id === id ? { ...r, resolved: true } : r));
    toast.success(action, `Redundancy ${action.toLowerCase()}`);
  };

  const filtered = filter === "all" ? results : results.filter((r) => r.type === filter && !r.resolved);

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b px-4 py-2.5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Redundancy analyzer</h2>
        <div className="flex-1" />
        <div className="flex items-center gap-1 text-[10px]">
          {(["all","duplicate","contained","overlapping"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-full px-2.5 py-0.5 font-medium capitalize min-touch ${filter === f ? "bg-peach-500 text-white" : "hover:bg-gray-100"}`}
              style={{ color: filter === f ? "#fff" : "var(--text-secondary)" }}>
              {f === "all" ? "All" : TYPE_LABELS[f].label}
            </button>
          ))}
        </div>
        {results.length > 0 && !analyzing && (
          <button onClick={runAnalysis}
            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-secondary)" }}>
            <Search size={11} /> Re-analyze
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Analyze button (initial) */}
        {results.length === 0 && !analyzing && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Analyze redundancies</p>
            <p className="text-xs opacity-30 mb-4 text-center max-w-[400px]">
              Detect duplicate, contained, and overlapping citations to clean up your coding
            </p>
            <button onClick={runAnalysis}
              className="flex items-center gap-2 rounded-lg bg-peach-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-peach-700 min-touch">
              <Play size={14} /> Analyze
            </button>
          </div>
        )}

        {/* Progress */}
        {analyzing && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-3xl animate-pulse mb-4">⏳</div>
            <div className="w-[300px] h-3 rounded-full bg-gray-200 overflow-hidden mb-2">
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: "var(--peach)" }} />
            </div>
            <p className="text-xs opacity-30">{progress}% — Scanning citations...</p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && !analyzing && (
          <div className="space-y-2">
            {/* Bulk actions */}
            {selected.size > 0 && (
              <div className="flex items-center gap-2 mb-3 px-2">
                <span className="text-[10px] opacity-30">{selected.size} selected</span>
                <button onClick={mergeAll}
                  className="flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-green-700 min-touch">
                  <GitMerge size={10} /> Merge all selected
                </button>
                <button onClick={() => { setResults([]); toast.success("Ignored", "All redundancies dismissed"); }}
                  className="flex items-center gap-1 rounded border px-3 py-1.5 text-[10px] min-touch"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  <Check size={10} /> Ignore all
                </button>
              </div>
            )}

            {filtered.map((r) => (
              <div key={r.id} className={`rounded-lg border p-3.5 ${selected.has(r.id) ? "ring-1" : ""} ${r.resolved ? "opacity-30" : ""}`}
                style={{
                  borderColor: selected.has(r.id) ? "var(--peach)" : "var(--border)",
                  backgroundColor: selected.has(r.id) ? "var(--peach)" + "05" : "var(--bg-panel)",
                }}>
                {/* Type badge */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                    style={{ backgroundColor: TYPE_LABELS[r.type].color + "15", color: TYPE_LABELS[r.type].color }}>
                    {TYPE_LABELS[r.type].icon} {TYPE_LABELS[r.type].label}
                  </span>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)}
                    style={{ accentColor: "var(--peach)" }} />
                  <span className="text-[9px] opacity-20 ml-auto">{r.docA}{r.docA !== r.docB ? ` / ${r.docB}` : ""}</span>
                </div>

                {/* Text comparison */}
                <div className="grid grid-cols-2 gap-3 text-[10px]">
                  <div className="rounded p-2 italic" style={{ backgroundColor: "var(--bg-secondary)", fontFamily: "'Lora', Georgia, serif" }}>
                    &ldquo;{r.textA}&rdquo;
                  </div>
                  <div className="rounded p-2 italic" style={{ backgroundColor: "var(--bg-secondary)", fontFamily: "'Lora', Georgia, serif" }}>
                    &ldquo;{r.textB}&rdquo;
                  </div>
                </div>

                {/* Actions */}
                {!r.resolved && (
                  <div className="flex items-center gap-1 mt-2">
                    <button onClick={() => resolveAction(r.id, "Merged")}
                      className="flex items-center gap-1 rounded px-2 py-1 text-[9px] font-medium text-white min-touch"
                      style={{ backgroundColor: "#4CAF50" }}>
                      <GitMerge size={9} /> Merge
                    </button>
                    <button onClick={() => resolveAction(r.id, "Kept A")}
                      className="rounded px-2 py-1 text-[9px] min-touch hover:bg-gray-100" style={{ color: "var(--text-secondary)" }}>
                      <Scissors size={9} className="inline mr-0.5" /> Keep A
                    </button>
                    <button onClick={() => resolveAction(r.id, "Kept B")}
                      className="rounded px-2 py-1 text-[9px] min-touch hover:bg-gray-100" style={{ color: "var(--text-secondary)" }}>
                      <Scissors size={9} className="inline mr-0.5" /> Keep B
                    </button>
                    <div className="flex-1" />
                    <button onClick={() => resolveAction(r.id, "Ignored")}
                      className="rounded px-2 py-1 text-[9px] opacity-30 hover:opacity-60 min-touch">
                      Ignore
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Export */}
            <div className="flex justify-center pt-3">
              <button onClick={() => toast.info("Export", "Exporting redundancies to Excel...")}
                className="flex items-center gap-1 rounded border px-3 py-1.5 text-[10px] hover:bg-gray-50 min-touch"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                <Download size={10} /> Export to Excel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default RedundancyAnalyzer;
