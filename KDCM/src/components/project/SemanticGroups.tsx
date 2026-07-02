import { useState } from "react";
import { Plus, Download, Upload, X } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";

interface GroupDimension { id: string; dimension: string; value: string; color: string; }
interface DocAssignment { docId: string; docName: string; groupId: string | null; }

const PALETTE = ["#2196F3","#4CAF50","#F1D7FF","#9C27B0","#F44336","#00BCD4","#F1D7FF","#607D8B"];

export function SemanticGroups() {
  const documents = useProjectStore((s) => s.documents);
  const [dimensions, setDimensions] = useState<GroupDimension[]>([
    { id: "d1", dimension: "gender", value: "female", color: "#F1D7FF" },
    { id: "d2", dimension: "gender", value: "male", color: "#2196F3" },
    { id: "d3", dimension: "region", value: "urban", color: "#4CAF50" },
    { id: "d4", dimension: "region", value: "rural", color: "#F1D7FF" },
  ]);
  const [assignments, setAssignments] = useState<DocAssignment[]>(
    documents.slice(0, 6).map((d) => ({ docId: d.id, docName: d.name, groupId: null }))
  );
  const [newDim, setNewDim] = useState("");
  const [newVal, setNewVal] = useState("");
  const { toast } = useToast();

  const addGroup = () => {
    if (!newDim.trim() || !newVal.trim()) return;
    setDimensions((prev) => [...prev, {
      id: `d-${Date.now()}`, dimension: newDim.trim(), value: newVal.trim(),
      color: PALETTE[dimensions.length % PALETTE.length],
    }]);
    setNewDim(""); setNewVal("");
    toast.success("Added", `Group "${newDim}::${newVal}"`);
  };

  const uniqueDimensions = [...new Set(dimensions.map((d) => d.dimension))];

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Semantic groups</h2>
        <span className="text-[9px] opacity-20 ml-2">Used in: Marimekko · Group comparison · Parallel coords</span>
        <div className="flex-1" />
        <button onClick={() => toast.info("Import groups", "Import semantic groups from a CSV file")}
          className="flex items-center gap-1 rounded border px-2 py-1 text-[10px] hover:bg-gray-50 min-touch"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <Upload size={10} /> Import
        </button>
        <button onClick={() => toast.info("Export groups", "Export semantic groups to CSV")}
          className="flex items-center gap-1 rounded border px-2 py-1 text-[10px] hover:bg-gray-50 min-touch"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <Download size={10} /> Export
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Define groups */}
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
          <p className="text-[10px] font-medium uppercase opacity-30 mb-3">Define groups</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {dimensions.map((d) => (
              <span key={d.id} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium"
                style={{ borderColor: d.color, backgroundColor: d.color + "15", color: d.color }}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
                {d.dimension}::{d.value}
                <button onClick={() => setDimensions((prev) => prev.filter((x) => x.id !== d.id))}
                  className="rounded-full p-0.5 hover:bg-black/10"><X size={9} /></button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input value={newDim} onChange={(e) => setNewDim(e.target.value)}
              placeholder="Dimension (e.g. gender)"
              className="rounded border px-2.5 py-1.5 text-[11px] outline-none w-[140px]"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
            <input value={newVal} onChange={(e) => setNewVal(e.target.value)}
              placeholder="Value (e.g. female)"
              className="rounded border px-2.5 py-1.5 text-[11px] outline-none w-[140px]"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
            <button onClick={addGroup}
              className="flex items-center gap-1 rounded bg-peach-500 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-peach-700 min-touch">
              <Plus size={11} /> Add
            </button>
          </div>
        </div>

        {/* Assign documents */}
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)" }}>
          <p className="text-[10px] font-medium uppercase opacity-30 mb-3">Assign documents to groups</p>
          <div className="space-y-1.5">
            {assignments.map((a) => (
              <div key={a.docId} className="flex items-center gap-3 text-[11px]">
                <span className="w-[150px] truncate" style={{ color: "var(--text-primary)" }}>📄 {a.docName}</span>
                <span className="opacity-20">→</span>
                <select value={a.groupId ?? ""}
                  onChange={(e) => setAssignments((prev) => prev.map((x) => x.docId === a.docId ? { ...x, groupId: e.target.value || null } : x))}
                  className="rounded border px-2 py-1.5 text-[11px] outline-none flex-1 max-w-[250px]"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  <option value="">— No group —</option>
                  {uniqueDimensions.map((dim) => (
                    <optgroup key={dim} label={dim}>
                      {dimensions.filter((d) => d.dimension === dim).map((d) => (
                        <option key={d.id} value={d.id}>{d.value}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SemanticGroups;
