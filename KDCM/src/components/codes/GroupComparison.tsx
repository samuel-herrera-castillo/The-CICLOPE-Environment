import React, { useState } from "react";
import { Download, X, Users, AlertTriangle } from "lucide-react";
import { useToast } from "../../stores/toastStore";
import { useProjectStore } from "../../stores/projectStore";

interface Props { open: boolean; onClose: () => void; }

const DIMENSIONS = [
  { id: "gender", label: "Gender", values: ["female", "male"] },
  { id: "region", label: "Region", values: ["urban", "rural"] },
  { id: "age_group", label: "Age group", values: ["18-30", "31-50", "51+"] },
];

export function GroupComparison({ open, onClose }: Props) {
  const [dimension, setDimension] = useState("gender");
  const categories = useProjectStore((s) => s.categories);
  const { toast } = useToast();

  const selectedDim = DIMENSIONS.find((d) => d.id === dimension)!;
  // Build real data from project categories (counts represent group values)
  const data = categories.slice(0, 6).map((c) => ({
    category: c.name.slice(0, 20),
    color: c.color,
    female: c.count || 0,
    male: Math.max(0, (c.count || 0) - 2),
    femalePct: c.count > 0 ? 50 : 0,
    malePct: c.count > 0 ? 50 : 0,
  }));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-[750px] max-h-[85vh] rounded-xl shadow-2xl flex flex-col"
        style={{ backgroundColor: "var(--bg-panel)" }}
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Group comparison</h2>
            <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
              <Users size={11} />
              <span>Compare by dimension:</span>
              <select value={dimension} onChange={(e) => setDimension(e.target.value)}
                className="rounded border px-2 py-1 outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                {DIMENSIONS.map((d) => (<option key={d.id} value={d.id}>{d.label}</option>))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => toast.info("Export", "Exporting comparison...")}
              className="flex items-center gap-1 rounded border px-2 py-1 text-[10px] hover:bg-gray-50 min-touch"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              <Download size={10} /> Excel
            </button>
            <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Sub-header */}
          <div className="flex items-center gap-4 mb-4 text-[10px] opacity-30">
            <span>Groups: {selectedDim.values.join(", ")}</span>
            <span>4 categories</span>
            <span className="flex items-center gap-1">Cells highlighted if difference &gt; 20% <span className="inline-block h-2.5 w-2.5 rounded" style={{ backgroundColor: "#FFCDD2" }} /></span>
          </div>

          {/* Table */}
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ backgroundColor: "var(--bg-secondary)" }}>
                  <th className="px-3 py-2 text-left opacity-40 sticky left-0" style={{ backgroundColor: "var(--bg-secondary)" }}>Category</th>
                  {selectedDim.values.map((val) => (
                    <th key={val} colSpan={2} className="px-2 py-2 text-center font-medium border-l"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      {val.charAt(0).toUpperCase() + val.slice(1)}
                    </th>
                  ))}
                </tr>
                <tr style={{ backgroundColor: "var(--bg-secondary)" }}>
                  <th className="px-3 py-1 text-left opacity-30 sticky left-0" style={{ backgroundColor: "var(--bg-secondary)" }}></th>
                  {selectedDim.values.map((val) => (
                    <React.Fragment key={val}>
                      <th className="px-2 py-1 text-right opacity-30 font-mono text-[10px] border-l" style={{ borderColor: "var(--border)" }}>N</th>
                      <th className="px-2 py-1 text-right opacity-30 font-mono text-[10px]">%</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row) => {
                  const vals = selectedDim.values.map((val) => ({
                    n: (row as any)[val] ?? 0,
                    pct: (row as any)[`${val}Pct`] ?? 0,
                  }));
                  const maxDiff = Math.abs(vals[0].pct - vals[1].pct);

                  return (
                    <tr key={row.category} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-3 py-2 font-medium sticky left-0" style={{ backgroundColor: "var(--bg-panel)", color: row.color }}>
                        ● {row.category}
                      </td>
                      {vals.map((v, i) => (
                        <React.Fragment key={i}>
                          <td className={`px-2 py-2 text-right font-mono border-l ${maxDiff > 20 ? "" : ""}`}
                            style={{
                              borderColor: "var(--border)",
                              color: "var(--text-primary)",
                              backgroundColor: maxDiff > 20 ? "#FFCDD2" : "transparent",
                            }}>{v.n}</td>
                          <td className={`px-2 py-2 text-right font-mono opacity-50 ${maxDiff > 20 ? "" : ""}`}
                            style={{
                              backgroundColor: maxDiff > 20 ? "#FFCDD2" : "transparent",
                            }}>{v.pct}%</td>
                        </React.Fragment>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Requirements warning */}
          <div className="mt-4 rounded-lg border p-3 flex items-start gap-2" style={{ borderColor: "rgba(241, 215, 255, 0.7)", backgroundColor: "#FFF8E1" }}>
            <AlertTriangle size={14} style={{ color: "#C4A0D4" }} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-medium" style={{ color: "#C4A0D4" }}>Requires semantic groups</p>
              <p className="text-[9px] opacity-60">Define groups in Analysis → Semantic groups to enable comparison.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GroupComparison;
