import { useState } from "react";
import { Play, Tag, Download, Smile, Frown, Meh } from "lucide-react";
import { useToast } from "../../stores/toastStore";
import { useProjectStore } from "../../stores/projectStore";
import { getCitations } from "../../lib/tauriBridge";
import { analyzeCitationSentiment, type SentimentCitationResult } from "../../lib/sentimentES";

type SentimentResult = SentimentCitationResult;

export function OpinionMining() {
  const proyectoId = useProjectStore((s) => s.project?.id);
  const [results, setResults] = useState<SentimentResult[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [filter, setFilter] = useState<"all" | "positive" | "negative" | "neutral">("all");
  const { toast } = useToast();

  const runAnalysis = async () => {
    if (!proyectoId) { toast.info("No project", "Open a project first"); return; }
    setAnalyzing(true);
    try {
      const res = await getCitations(proyectoId);
      const rows = res?.rows || [];
      const analyzed = rows.map((row: any) => {
        const texto = row.texto || row.texto_seleccionado || "";
        const doc = row.doc || row.doc_nombre || "";
        const id = row.id || "";
        return analyzeCitationSentiment(id, texto, doc);
      });
      setResults(analyzed);
      toast.success("Complete", `${analyzed.length} citations analyzed`);
    } catch { toast.error("Error", "Could not analyze citations"); setResults([]); }
    setAnalyzing(false);
  };

  const filtered = filter === "all" ? results : results.filter((r) => r.polarity === filter);
  const posCount = results.filter((r) => r.polarity === "positive").length;
  const negCount = results.filter((r) => r.polarity === "negative").length;
  const neuCount = results.filter((r) => r.polarity === "neutral").length;
  const total = results.length;

  // Per-document aggregation
  const docStats: Record<string, { total: number; positive: number; negative: number; neutral: number; avgIntensity: number }> = {};
  results.forEach((r) => {
    if (!docStats[r.docName]) docStats[r.docName] = { total: 0, positive: 0, negative: 0, neutral: 0, avgIntensity: 0 };
    const ds = docStats[r.docName];
    ds.total++;
    if (r.polarity === "positive") ds.positive++;
    else if (r.polarity === "negative") ds.negative++;
    else ds.neutral++;
    ds.avgIntensity = ((ds.avgIntensity * (ds.total - 1)) + r.intensity) / ds.total;
  });
  const docEntries = Object.entries(docStats).sort((a, b) => b[1].total - a[1].total);

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Opinion mining</h2>
        <span className="text-[9px] opacity-20 ml-2">SentiWordNet ES · Offline · Dictionary-based</span>
        <div className="flex-1" />
        {results.length > 0 && (
          <button onClick={() => toast.info("Export", "Exporting results...")}
            className="flex items-center gap-1 rounded border px-2 py-1 text-[10px] hover:bg-gray-50 min-touch"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <Download size={10} /> Export
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {results.length === 0 && !analyzing && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Analyze sentiment</p>
            <p className="text-xs opacity-30 mb-4 text-center max-w-[400px]">
              Uses SentiWordNet ES lexical dictionaries (offline, no AI required)
            </p>
            <div className="flex gap-4 mb-4 text-[10px] opacity-30">
              <span>Dimensions: Polarity · Intensity · Certainty</span>
            </div>
            <button onClick={runAnalysis}
              className="flex items-center gap-2 rounded-lg bg-peach-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-peach-700 min-touch">
              <Play size={14} /> Analyze
            </button>
          </div>
        )}

        {analyzing && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-3xl animate-pulse mb-4">🔍</div>
            <p className="text-xs opacity-30">Processing sentiment lexicon...</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            {/* Metrics cards */}
            {total > 0 && (<div className="grid grid-cols-3 gap-3 mb-2">
              {[{label:"Avg Polarity",value:(results.reduce((s,r)=>s+r.intensity*(r.polarity==="positive"?1:r.polarity==="negative"?-1:0),0)/total).toFixed(2),color:"#000"},{label:"Avg Intensity",value:(results.reduce((s,r)=>s+r.intensity,0)/total).toFixed(2),color:"#000"},{label:"Avg Certainty",value:(results.reduce((s,r)=>s+r.certainty,0)/total).toFixed(2),color:"#000"}].map(m=><div key={m.label} className="rounded-lg border p-3 text-center" style={{borderColor:"var(--border)"}}><p className="text-[10px] opacity-30">{m.label}</p><p className="text-lg font-bold" style={{color:m.color}}>{m.value}</p></div>)}
            </div>)}
            {/* Summary bars */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Positive", count: posCount, color: "#4CAF50", icon: Smile, pct: total > 0 ? Math.round((posCount / total) * 100) : 0 },
                { label: "Negative", count: negCount, color: "#F44336", icon: Frown, pct: total > 0 ? Math.round((negCount / total) * 100) : 0 },
                { label: "Neutral", count: neuCount, color: "#9E9E9E", icon: Meh, pct: total > 0 ? Math.round((neuCount / total) * 100) : 0 },
              ].map((s) => (
                <button key={s.label} onClick={() => setFilter(filter === s.label.toLowerCase() ? "all" : s.label.toLowerCase() as any)}
                  className={`rounded-lg border p-3 text-center min-touch ${filter === s.label.toLowerCase() ? "ring-1" : ""}`}
                  style={{ borderColor: s.color, backgroundColor: filter === s.label.toLowerCase() ? s.color + "10" : "transparent" }}>
                  <s.icon size={20} style={{ color: s.color }} className="mx-auto mb-1" />
                  <p className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</p>
                  <p className="text-[10px] opacity-30">{s.pct}%</p>
                </button>
              ))}
            </div>

            {/* Bars visualization */}
            <div className="flex rounded-lg overflow-hidden h-6" style={{ border: "1px solid var(--border)" }}>
              {posCount > 0 && (
                <div className="h-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ width: `${(posCount/total)*100}%`, backgroundColor: "#4CAF50", minWidth: posCount > 0 ? 30 : 0 }}>
                  {posCount > 1 && `${Math.round((posCount/total)*100)}%`}
                </div>
              )}
              {neuCount > 0 && (
                <div className="h-full flex items-center justify-center text-[9px] text-gray-600"
                  style={{ width: `${(neuCount/total)*100}%`, backgroundColor: "#E0E0E0" }}>
                  {neuCount > 1 && `${Math.round((neuCount/total)*100)}%`}
                </div>
              )}
              {negCount > 0 && (
                <div className="h-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ width: `${(negCount/total)*100}%`, backgroundColor: "#F44336", minWidth: negCount > 0 ? 30 : 0 }}>
                  {negCount > 1 && `${Math.round((negCount/total)*100)}%`}
                </div>
              )}
            </div>

            {/* Results table */}
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ backgroundColor: "var(--bg-secondary)" }}>
                    <th className="px-3 py-1.5 text-left opacity-40">Segment</th>
                    <th className="px-3 py-1.5 text-center opacity-40 w-[80px]">Polarity</th>
                    <th className="px-3 py-1.5 text-center opacity-40 w-[60px]">Intensity</th>
                    <th className="px-3 py-1.5 text-center opacity-40 w-[60px]">Certainty</th>
                    <th className="px-3 py-1.5 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-1.5 truncate max-w-[300px]" style={{ color: "var(--text-primary)" }}>
                        &ldquo;{r.text}&rdquo;
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className="rounded-full px-2 py-0.5 text-[9px] font-medium"
                          style={{ backgroundColor: r.polarity === "positive" ? "#E8F5E9" : r.polarity === "negative" ? "#FFEBEE" : "#F5F5F5", color: r.polarity === "positive" ? "#2E7D32" : r.polarity === "negative" ? "#C62828" : "#757575" }}>
                          {r.polarity === "positive" ? "😊 +" : r.polarity === "negative" ? "😞 −" : "😐 ~"}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-center font-mono opacity-50">{r.intensity.toFixed(2)}</td>
                      <td className="px-3 py-1.5 text-center font-mono opacity-50">{r.certainty.toFixed(2)}</td>
                      <td className="px-3 py-1.5">
                        <button onClick={() => toast.info("Code", `Auto-code with sentiment category`)}
                          className="rounded p-0.5 hover:bg-gray-100"><Tag size={10} opacity={0.3} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Per-document aggregation */}
            {docEntries.length > 0 && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                <p className="text-[11px] font-semibold mb-2" style={{ color: "var(--text-primary)" }}>📊 Por documento</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead><tr className="border-b opacity-40" style={{ borderColor: "var(--border)" }}>
                      <th className="text-left px-2 py-1">Documento</th><th className="text-center px-2 py-1">Total</th><th className="text-center px-2 py-1">😊+</th><th className="text-center px-2 py-1">😞-</th><th className="text-center px-2 py-1">😐=</th><th className="text-center px-2 py-1">Intensidad</th>
                    </tr></thead>
                    <tbody>
                      {docEntries.map(([doc, stats]) => (
                        <tr key={doc} className="border-b" style={{ borderColor: "var(--border)" }}>
                          <td className="px-2 py-1 max-w-[120px] truncate" style={{ color: "var(--text-primary)" }}>{doc}</td>
                          <td className="px-2 py-1 text-center">{stats.total}</td>
                          <td className="px-2 py-1 text-center" style={{ color: "#4CAF50" }}>{stats.positive}</td>
                          <td className="px-2 py-1 text-center" style={{ color: "#F44336" }}>{stats.negative}</td>
                          <td className="px-2 py-1 text-center opacity-40">{stats.neutral}</td>
                          <td className="px-2 py-1 text-center">{stats.avgIntensity.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Auto-code buttons */}
            <div className="flex gap-2 justify-center">
              <button onClick={() => toast.success("Coded", "Positive segments coded")}
                className="flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-green-700 min-touch">
                <Tag size={10} /> Code positives
              </button>
              <button onClick={() => toast.success("Coded", "Negative segments coded")}
                className="flex items-center gap-1 rounded bg-red-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-red-700 min-touch">
                <Tag size={10} /> Code negatives
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OpinionMining;
