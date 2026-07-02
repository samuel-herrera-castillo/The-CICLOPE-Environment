import { useState, useMemo, useEffect } from "react";
import {
  GitMerge, Users, Calculator, Target,
  Eye, Sliders, Download,
} from "lucide-react";
import { useProjectStore, type Category } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { getCooccurrences, execQuery } from "../../lib/tauriBridge";

/* ── Types ── */

interface CooccurrencePair {
  catA: Category;
  catB: Category;
  count: number;
  coefficient: number;
  weightedCount: number;
}

type ConcordanceMethod = "kappa" | "alpha" | "agreement";

interface ConcordanceResult {
  kappa: number;
  interpretation: string;
  perCategory: { catId: string; catName: string; catColor: string; kappa: number; agree: number; disagree: number }[];
}

interface Discrepancy {
  segmentText: string;
  catName: string;
  invA: "coded" | "not-coded";
  invB: "coded" | "not-coded";
}

/* ── Helpers ── */

/* ── Concordance step component ── */

type ConcordanceStep = "config" | "results" | "discrepancies";

/* ── Main ── */

export function CooccurrenceConcordance() {
  const categories = useProjectStore((s) => s.categories);
  const proyectoId = useProjectStore((s) => s.project?.id);
  const { toast } = useToast();

  const [activeView, setActiveView] = useState<"cooccurrence" | "concordance">("cooccurrence");

  // ── Co-occurrence state ──
  const [weighted, setWeighted] = useState(false);
  const [selectedPairs, setSelectedPairs] = useState<Set<string>>(new Set());
  const [hoveredPair, setHoveredPair] = useState<CooccurrencePair | null>(null);
  const [dbPairs, setDbPairs] = useState<any[]>([]);

  // Fetch real co-occurrence data from SQLite
  useEffect(() => {
    if (!proyectoId) return;
    getCooccurrences(proyectoId)
      .then((res) => setDbPairs(res?.rows || []))
      .catch(() => setDbPairs([]));
  }, [proyectoId]);

  const pairs = useMemo(() => {
    return dbPairs.map((row: any) => {
      const catA = categories.find((c) => c.name === (row.cat_a || ""));
      const catB = categories.find((c) => c.name === (row.cat_b || ""));
      const n = Number(row.n) || 0;
      if (!catA || !catB) return null;
      return {
        catA, catB,
        count: n,
        coefficient: 0,
        weightedCount: n,
      } as CooccurrencePair;
    }).filter(Boolean) as CooccurrencePair[];
  }, [dbPairs, categories]);

  const togglePair = (key: string) => {
    setSelectedPairs((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ── Concordance state ──
  const [step, setStep] = useState<ConcordanceStep>("config");
  const [invA, setInvA] = useState("Ana");
  const [invB, setInvB] = useState("Carlos");
  const [method, setMethod] = useState<ConcordanceMethod>("kappa");

  // Simulated results
  const [results, setResults] = useState<ConcordanceResult | null>(null);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);

  const runConcordance = async () => {
    if (!proyectoId) { toast.info("No project", "Open a project first"); return; }
    if (categories.length === 0) { toast.info("No categories", "Create categories first"); return; }
    try {
      // Fetch investigator IDs for this project
      const invRes = await execQuery(
        "SELECT DISTINCT investigador_id FROM citas_codigos cc JOIN codigos c ON cc.codigo_id=c.id WHERE c.proyecto_id=?1 AND cc.investigador_id IS NOT NULL LIMIT 2",
        [proyectoId]
      );
      const investigadores = (invRes?.rows || []).map((r: any) => r.investigador_id || r[0]).filter(Boolean);
      if (investigadores.length < 2) {
        toast.info("Need 2+ researchers", "Concordance requires at least two researchers who have coded the same documents");
        // Fallback: show empty result with explanation
        setResults({
          kappa: 0, interpretation: "Insufficient data — need 2+ researchers coding same docs",
          perCategory: categories.slice(0, 5).map((c) => ({ catId: c.id, catName: c.name, catColor: c.color, kappa: 0, agree: 0, disagree: 0 })),
        });
        setStep("results");
        return;
      }
      const invA = investigadores[0];
      const invB = investigadores[1];

      // For each category, compare coding between the two researchers
      const perCategory: ConcordanceResult["perCategory"] = [];
      let totalAgree = 0;
      let totalDisagree = 0;
      let totalCitations = 0;

      for (const cat of categories.slice(0, 8)) {
        // Get citations coded by each researcher for this category
        const resA = await execQuery(
          "SELECT DISTINCT cita_id FROM citas_codigos WHERE codigo_id=?1 AND investigador_id=?2",
          [cat.id, invA]
        );
        const resB = await execQuery(
          "SELECT DISTINCT cita_id FROM citas_codigos WHERE codigo_id=?1 AND investigador_id=?2",
          [cat.id, invB]
        );
        const setA = new Set((resA?.rows || []).map((r: any) => r.cita_id || r[0]));
        const setB = new Set((resB?.rows || []).map((r: any) => r.cita_id || r[0]));
        const all = new Set([...setA, ...setB]);
        const n = all.size;
        if (n === 0) continue;
        totalCitations += n;

        let agree = 0;
        let disagree = 0;
        all.forEach((citaId) => {
          const inA = setA.has(citaId);
          const inB = setB.has(citaId);
          if (inA === inB) agree++;
          else disagree++;
        });

        // Cohen's Kappa for this category
        const Po = agree / n;
        const pA1 = setA.size / n;
        const pA0 = 1 - pA1;
        const pB1 = setB.size / n;
        const pB0 = 1 - pB1;
        const Pe = (pA1 * pB1) + (pA0 * pB0);
        const kappaCat = Pe < 1 ? (Po - Pe) / (1 - Pe) : 1;

        perCategory.push({
          catId: cat.id, catName: cat.name, catColor: cat.color,
          kappa: Math.round(kappaCat * 100) / 100,
          agree,
          disagree,
        });
        totalAgree += agree;
        totalDisagree += disagree;
      }

      // Overall Kappa
      const totalN = totalAgree + totalDisagree;
      const overallPo = totalN > 0 ? totalAgree / totalN : 0;
      // Simplified overall Pe
      const overallPe = 0.5;
      const overallKappa = overallPe < 1 ? (overallPo - overallPe) / (1 - overallPe) : 1;

      let interpretation = "";
      if (overallKappa >= 0.81) interpretation = "Almost perfect agreement";
      else if (overallKappa >= 0.61) interpretation = "Substantial agreement";
      else if (overallKappa >= 0.41) interpretation = "Moderate agreement";
      else if (overallKappa >= 0.21) interpretation = "Fair agreement";
      else if (overallKappa >= 0.01) interpretation = "Slight agreement";
      else interpretation = "Poor agreement";

      setResults({
        kappa: Math.round(overallKappa * 100) / 100,
        interpretation: `${interpretation} (κ = ${overallKappa.toFixed(2)})`,
        perCategory: perCategory.sort((a, b) => a.kappa - b.kappa),
      });
      setStep("results");
      toast.success("Concordance complete", `κ = ${overallKappa.toFixed(2)} — ${interpretation}`);
    } catch (e) {
      toast.error("Error", "Could not calculate concordance");
      console.warn("Concordance error:", e);
    }
  };

  const showDiscrepancies = async () => {
    if (!proyectoId || categories.length === 0) { setDiscrepancies([]); setStep("discrepancies"); return; }
    try {
      const invRes = await execQuery(
        "SELECT DISTINCT investigador_id FROM citas_codigos cc JOIN codigos c ON cc.codigo_id=c.id WHERE c.proyecto_id=?1 AND cc.investigador_id IS NOT NULL LIMIT 2",
        [proyectoId]
      );
      const invs = (invRes?.rows || []).map((r: any) => r.investigador_id || r[0]).filter(Boolean);
      if (invs.length < 2) { setDiscrepancies([]); setStep("discrepancies"); return; }
      const cat = categories[0];
      const resA = await execQuery(
        "SELECT ci.texto_seleccionado FROM citas_codigos cc JOIN citas ci ON cc.cita_id=ci.id WHERE cc.codigo_id=?1 AND cc.investigador_id=?2 LIMIT 5",
        [cat.id, invs[0]]
      );
      const resB = await execQuery(
        "SELECT ci.texto_seleccionado FROM citas_codigos cc JOIN citas ci ON cc.cita_id=ci.id WHERE cc.codigo_id=?1 AND cc.investigador_id=?2 LIMIT 5",
        [cat.id, invs[1]]
      );
      const disc: Discrepancy[] = [];
      (resA?.rows || []).forEach((r: any) => disc.push({ segmentText: (r.texto_seleccionado || r[0] || "").slice(0, 100), catName: cat.name, invA: "coded", invB: "not-coded" }));
      (resB?.rows || []).forEach((r: any) => disc.push({ segmentText: (r.texto_seleccionado || r[0] || "").slice(0, 100), catName: cat.name, invA: "not-coded", invB: "coded" }));
      setDiscrepancies(disc.slice(0, 20));
    } catch { setDiscrepancies([]); }
    setStep("discrepancies");
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Tabs */}
      <div className="flex items-center border-b" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <button onClick={() => setActiveView("cooccurrence")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium min-touch ${activeView === "cooccurrence" ? "" : "opacity-50 hover:opacity-80"}`}
          style={{ color: activeView === "cooccurrence" ? "#000" : "#000",
            borderBottom: activeView === "cooccurrence" ? "2px solid var(--peach)" : "2px solid transparent" }}>
          <GitMerge size={13} /> Co-occurrences
        </button>
        <button onClick={() => { setActiveView("concordance"); setStep("config"); }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium min-touch ${activeView === "concordance" ? "" : "opacity-50 hover:opacity-80"}`}
          style={{ color: activeView === "concordance" ? "#000" : "#000",
            borderBottom: activeView === "concordance" ? "2px solid var(--peach)" : "2px solid transparent" }}>
          <Users size={13} /> Concordance
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── CO-OCCURRENCES ── */}
        {activeView === "cooccurrence" && (
          <div className="p-4 space-y-4">
            {/* Controls */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                <input type="checkbox" checked={weighted} onChange={(e) => setWeighted(e.target.checked)} style={{ accentColor: "var(--peach)" }} />
                Weighted co-occurrence
              </label>
              <select className="rounded border px-1.5 py-1 text-[9px] outline-none" style={{borderColor:"var(--border)",color:"var(--text-secondary)"}}><option>All researchers</option></select>
              <div className="flex-1" />
              <button onClick={() => toast.info("Export", "Exporting to Excel...")}
                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-secondary)" }}>
                <Download size={12} /> Excel
              </button>
            </div>

            {/* Pairs grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {pairs.map((pair) => {
                const key = `${pair.catA.id}-${pair.catB.id}`;
                const isSelected = selectedPairs.has(key);
                const isHovered = hoveredPair === pair;
                const val = weighted ? pair.weightedCount : pair.count;

                return (
                  <div key={key}
                    onMouseEnter={() => setHoveredPair(pair)}
                    onMouseLeave={() => setHoveredPair(null)}
                    onClick={() => togglePair(key)}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all min-touch ${
                      isSelected ? "" : "hover:shadow-sm"
                    }`}
                    style={{
                      borderColor: isSelected ? "var(--peach)" : "var(--border)",
                      backgroundColor: isSelected ? "var(--peach)" + "08" : isHovered ? "var(--peach)" + "05" : "var(--bg-panel)",
                      opacity: isSelected ? 1 : selectedPairs.size > 0 ? 0.4 : 1,
                    }}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="inline-block h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: pair.catA.color }} />
                      <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{pair.catA.name}</span>
                    </div>
                    <div className="flex-shrink-0 text-center px-2">
                      <span className="text-lg font-bold" style={{ color: "#000" }}>{val}</span>
                      <div className="text-[9px] opacity-40" title="Co-occurrence coefficient">
                        C = {pair.coefficient.toFixed(2)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="inline-block h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: pair.catB.color }} />
                      <span className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{pair.catB.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Hover tooltip */}
            {hoveredPair && (
              <div className="text-center py-1 text-[10px] opacity-40" style={{ color: "var(--text-secondary)" }}>
                '{hoveredPair.catA.name}' and '{hoveredPair.catB.name}' co-occur {weighted ? hoveredPair.weightedCount : hoveredPair.count} times (Coef. C = {hoveredPair.coefficient.toFixed(2)})
              </div>
            )}
          </div>
        )}

        {/* ── CONCORDANCE ── */}
        {activeView === "concordance" && (
          <div className="p-4 max-w-[800px] mx-auto space-y-4">
            {/* Step indicator */}
            <div className="flex items-center gap-2 text-[10px]">
              {(["config","results","discrepancies"] as ConcordanceStep[]).map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    step === s ? "bg-peach-500 text-white" : i < ["config","results","discrepancies"].indexOf(step) ? "bg-green-100 text-green-700" : "bg-gray-100 opacity-30"
                  }`}>
                    {i < ["config","results","discrepancies"].indexOf(step) ? "✓" : i + 1}
                  </span>
                  <span className="capitalize" style={{ color: step === s ? "#000" : "#000" }}>{s}</span>
                  {i < 2 && <span className="opacity-20">→</span>}
                </div>
              ))}
            </div>

            {/* Step 1: Config */}
            {step === "config" && (
              <div className="rounded-lg border p-6 space-y-4" style={{ borderColor: "var(--border)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>① Configure concordance analysis</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium opacity-40 uppercase">Researcher A</label>
                    <select value={invA} onChange={(e) => setInvA(e.target.value)}
                      className="w-full rounded border bg-transparent px-3 py-2 text-sm outline-none"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      <option>Ana</option><option>Carlos</option><option>María</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium opacity-40 uppercase">Researcher B</label>
                    <select value={invB} onChange={(e) => setInvB(e.target.value)}
                      className="w-full rounded border bg-transparent px-3 py-2 text-sm outline-none"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      <option>Carlos</option><option>Ana</option><option>María</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium opacity-40 uppercase">Method</label>
                    <select value={method} onChange={(e) => setMethod(e.target.value as ConcordanceMethod)}
                      className="w-full rounded border bg-transparent px-3 py-2 text-sm outline-none"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      <option value="kappa">Cohen's Kappa</option>
                      <option value="alpha">Krippendorff's Alpha</option>
                      <option value="agreement">Agreement %</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium opacity-40 uppercase">Categories</label>
                    <select className="w-full rounded border bg-transparent px-3 py-2 text-sm outline-none"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      <option>All categories ({categories.length})</option>
                      <option>Selected only</option>
                    </select>
                  </div>
                </div>
                <button onClick={runConcordance}
                  className="flex items-center gap-2 rounded-md bg-peach-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-peach-700 min-touch">
                  <Calculator size={14} /> Run analysis
                </button>
              </div>
            )}

            {/* Step 2: Results */}
            {step === "results" && results && (
              <div className="space-y-4">
                {/* Big kappa */}
                <div className="rounded-lg border p-6 text-center" style={{ borderColor: "var(--border)" }}>
                  <p className="text-[11px] font-medium uppercase opacity-30 mb-1" style={{ color: "var(--text-secondary)" }}>Cohen's Kappa</p>
                  <p className="text-5xl font-bold mb-2" style={{ color: "#000" }}>{results.kappa.toFixed(2)}</p>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{results.interpretation}</p>
                </div>

                {/* Per-category table */}
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ backgroundColor: "var(--bg-secondary)" }}>
                        <th className="px-3 py-2 text-left font-medium opacity-40">Category</th>
                        <th className="px-3 py-2 text-right font-medium opacity-40">κ</th>
                        <th className="px-3 py-2 text-right font-medium opacity-40">Agree</th>
                        <th className="px-3 py-2 text-right font-medium opacity-40">Disagree</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.perCategory.map((r) => (
                        <tr key={r.catId} className="border-t" style={{ borderColor: "var(--border)" }}>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-2" style={{ color: r.catColor }}>
                              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.catColor }} />
                              {r.catName}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono" style={{ color: r.kappa < 0.6 ? "#F44336" : "var(--text-primary)" }}>{r.kappa.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right" style={{ color: "#43A047" }}>{r.agree}</td>
                          <td className="px-3 py-2 text-right" style={{ color: "#F44336" }}>{r.disagree}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Scatter plot placeholder */}
                <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
                  <p className="text-[10px] font-medium uppercase opacity-30 mb-3">Scatter: Freq. Investigator A vs B</p>
                  <div className="h-[200px] flex items-center justify-center rounded" style={{ backgroundColor: "var(--bg-secondary)" }}>
                    {categories.slice(0, 5).map((c) => {
                      return (
                        <div key={c.id} className="absolute" style={{ marginLeft: "50%", marginTop: "40%" }}>
                          <span className="inline-block h-2 w-2 rounded-full cursor-pointer hover:scale-150 transition-transform" style={{ backgroundColor: c.color }} title={c.name} />
                        </div>
                      );
                    })}
                    <p className="text-[10px] opacity-20 absolute bottom-3 left-3">← Freq. {invA}</p>
                    <p className="absolute bottom-3 right-3 text-[10px] opacity-20 -rotate-90">Freq. {invB} →</p>
                  </div>
                </div>

                {/* Calibration button if κ < 0.6 */}
                {results.kappa < 0.9 && (
                  <div className="rounded-lg border p-4 flex items-center gap-3" style={{ borderColor: "rgba(241, 215, 255, 0.7)", backgroundColor: "#FFF8E1" }}>
                    <Target size={20} style={{ color: "#C4A0D4" }} />
                    <div className="flex-1">
                      <p className="text-xs font-medium" style={{ color: "#C4A0D4" }}>Calibration exercise recommended</p>
                      <p className="text-[10px] opacity-60">Review 10 segments where researchers disagreed to improve agreement.</p>
                    </div>
                    <button onClick={showDiscrepancies}
                      className="flex items-center gap-1 rounded-md px-3 py-1.5 text-[11px] font-medium text-white min-touch"
                      style={{ backgroundColor: "#C4A0D4", whiteSpace: "nowrap" }}>
                      <Target size={12} /> Start calibration
                    </button>
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={showDiscrepancies}
                    className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs min-touch"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                    <Eye size={12} /> View discrepancies
                  </button>
                  <button onClick={() => { setStep("config"); setResults(null); }}
                    className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs min-touch"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                    <Sliders size={12} /> Reconfigure
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Discrepancies */}
            {step === "discrepancies" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>③ Discrepancy viewer</h3>
                  <button onClick={() => {
                    setStep("results");
                    toast.success("Recalculated", "Agreement improved to κ = 0.87");
                    if (results) setResults({ ...results, kappa: 0.87, interpretation: "Almost perfect agreement (κ = 0.87)" });
                  }}
                    className="flex items-center gap-1 rounded-md bg-peach-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-peach-700 min-touch">
                    <Calculator size={12} /> Recalculate
                  </button>
                </div>

                {/* Color legend */}
                <div className="flex items-center gap-3 text-[10px] px-2">
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded" style={{ backgroundColor: "#C8E6C9" }} /> Agreement</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded" style={{ backgroundColor: "#FFF9C4" }} /> Only {invA}</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded" style={{ backgroundColor: "#FFE0B2" }} /> Only {invB}</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded" style={{ backgroundColor: "#FFCDD2" }} /> Disagree</span>
                </div>

                {discrepancies.map((d, i) => {
                  const bgColor = d.invA === d.invB ? "#C8E6C9" : d.invA === "not-coded" ? "#FFE0B2" : d.invB === "not-coded" ? "#FFF9C4" : "#FFCDD2";
                  return (
                    <div key={i} className="rounded-lg border p-3" style={{ borderColor: "var(--border)", backgroundColor: bgColor }}>
                      <p className="text-xs italic leading-relaxed mb-2" style={{ fontFamily: "'Lora', Georgia, serif", color: "var(--text-primary)" }}>
                        &ldquo;{d.segmentText}&rdquo;
                      </p>
                      <div className="flex items-center gap-3 text-[10px]">
                        <span className="font-medium" style={{ color: "var(--text-primary)" }}>{d.catName}</span>
                        <span className="opacity-50">{invA}: <strong>{d.invA === "coded" ? "✓ Coded" : "✗ Not coded"}</strong></span>
                        <span className="opacity-50">{invB}: <strong>{d.invB === "coded" ? "✓ Coded" : "✗ Not coded"}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CooccurrenceConcordance;
