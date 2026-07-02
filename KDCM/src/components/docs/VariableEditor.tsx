import { useState } from "react";
import { Plus, Trash2, Calculator, AlertTriangle } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";

type VarType = "text" | "integer" | "decimal" | "date" | "boolean" | "categorical" | "calculated";

interface Variable {
  id: string; name: string; type: VarType; unit?: string;
  min?: number; max?: number; formula?: string;
  values: Record<string, string | number | boolean | null>;
}

const TYPE_OPTIONS: { id: VarType; label: string }[] = [
  { id: "text", label: "Text" }, { id: "integer", label: "Integer" }, { id: "decimal", label: "Decimal" },
  { id: "date", label: "Date" }, { id: "boolean", label: "Boolean" }, { id: "categorical", label: "Categorical" },
  { id: "calculated", label: "Calculated" },
];

export function VariableEditor() {
  const documents = useProjectStore((s) => s.documents);
  const { toast } = useToast();

  const [variables, setVariables] = useState<Variable[]>([
    { id: "v1", name: "Age", type: "integer", unit: "years", min: 18, max: 99, values: { "doc-1": 34, "doc-2": 28 } },
    { id: "v2", name: "Score", type: "decimal", min: 0, max: 100, values: {} },
    { id: "v3", name: "Frequency ratio", type: "calculated", formula: "freq(Emotion)/freq(Strategy)", values: {} },
  ]);

  const [editingCell, setEditingCell] = useState<{ varId: string; docId: string } | null>(null);
  const [cellValue, setCellValue] = useState("");

  const addVariable = () => {
    setVariables((prev) => [...prev, { id: `v${Date.now()}`, name: "New variable", type: "text", values: {} }]);
    toast.success("Variable added");
  };

  const updateVar = (id: string, patch: Partial<Variable>) => {
    setVariables((prev) => prev.map((v) => v.id === id ? { ...v, ...patch } : v));
  };

  const deleteVar = (id: string) => {
    setVariables((prev) => prev.filter((v) => v.id !== id));
    toast.success("Deleted", "Variable removed");
  };

  const startEdit = (varId: string, docId: string, current: string | number | boolean | null) => {
    setEditingCell({ varId, docId });
    setCellValue(current?.toString() ?? "");
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const variable = variables.find((v) => v.id === editingCell.varId);
    if (!variable) return;
    let val: string | number | boolean | null = cellValue;
    if (variable.type === "integer") val = parseInt(cellValue) || null;
    else if (variable.type === "decimal") val = parseFloat(cellValue) || null;
    else if (variable.type === "boolean") val = cellValue.toLowerCase() === "true";
    setVariables((prev) => prev.map((v) => v.id === editingCell.varId ? {
      ...v, values: { ...v.values, [editingCell.docId]: val },
    } : v));
    setEditingCell(null);
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Variables</h2>
        <div className="flex-1" />
        <button onClick={addVariable} className="flex items-center gap-1 rounded-md bg-peach-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-peach-700 min-touch">
          <Plus size={12} /> Add variable
        </button>
      </div>

      {/* Variable definitions */}
      <div className="border-b px-4 py-3 space-y-2 overflow-y-auto" style={{ borderColor: "var(--border)", maxHeight: 200 }}>
        {variables.map((v) => (
          <div key={v.id} className="flex items-center gap-2 text-xs">
            <input value={v.name} onChange={(e) => updateVar(v.id, { name: e.target.value })}
              className="w-[140px] rounded border px-2 py-1 outline-none flex-shrink-0"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
            <select value={v.type} onChange={(e) => updateVar(v.id, { type: e.target.value as VarType })}
              className="rounded border bg-transparent px-1.5 py-1 text-[11px] outline-none flex-shrink-0"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
              {TYPE_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            {v.type === "calculated" ? (
              <input value={v.formula ?? ""} onChange={(e) => updateVar(v.id, { formula: e.target.value })}
                placeholder="freq(CatA)/freq(CatB)" className="flex-1 rounded border px-2 py-1 outline-none font-mono text-[11px]"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
            ) : (
              <>
                {(v.type === "integer" || v.type === "decimal") && (
                  <div className="flex items-center gap-1 text-[10px] opacity-40">
                    min <input type="number" value={v.min ?? ""} onChange={(e) => updateVar(v.id, { min: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-14 rounded border px-1 py-0.5 outline-none" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
                    max <input type="number" value={v.max ?? ""} onChange={(e) => updateVar(v.id, { max: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-14 rounded border px-1 py-0.5 outline-none" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
                  </div>
                )}
                {v.unit && <span className="text-[10px] opacity-30 flex-shrink-0">{v.unit}</span>}
              </>
            )}
            <button onClick={() => deleteVar(v.id)} className="flex-shrink-0 rounded p-0.5 hover:bg-red-50 text-red-400"><Trash2 size={12} /></button>
          </div>
        ))}
      </div>

      {/* Data table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
              <th className="sticky left-0 border-r px-3 py-1.5 text-left font-medium w-[140px]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-secondary)" }}>Document</th>
              {variables.map((v) => (
                <th key={v.id} className="border-r px-3 py-1.5 text-left font-medium min-w-[140px]" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  {v.type === "calculated" && <Calculator size={10} className="inline mr-1 opacity-40" />}
                  {v.name} {v.unit && <span className="opacity-30">({v.unit})</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {documents.slice(0, 5).map((doc) => (
              <tr key={doc.id} className="border-b hover:bg-gray-50" style={{ borderColor: "var(--border)" }}>
                <td className="sticky left-0 border-r px-3 py-1.5 font-medium truncate" style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--bg-panel)" }}>{doc.name}</td>
                {variables.map((v) => {
                  const val = v.values[doc.id];
                  const isEditing = editingCell?.varId === v.id && editingCell?.docId === doc.id;
                  const outOfRange = (v.type === "integer" || v.type === "decimal") && typeof val === "number" && ((v.min !== undefined && val < v.min) || (v.max !== undefined && val > v.max));
                  return (
                    <td key={v.id} className="border-r px-3 py-1.5" style={{ borderColor: "var(--border)" }}>
                      {isEditing ? (
                        <input autoFocus value={cellValue} onChange={(e) => setCellValue(e.target.value)}
                          onBlur={commitEdit} onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null); }}
                          className="w-full rounded border px-1.5 py-0.5 text-[11px] outline-none"
                          style={{ borderColor: "var(--peach)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
                      ) : (
                        <div className="flex items-center gap-1 cursor-pointer min-h-[20px]" onClick={() => startEdit(v.id, doc.id, val ?? "")}
                          style={{ color: outOfRange ? "#F44336" : val !== undefined ? "var(--text-primary)" : "var(--border)" }}>
                          {v.type === "boolean" ? (val ? "✓" : "✗") : val?.toString() ?? "—"}
                          {outOfRange && <span title={`Out of range [${v.min}, ${v.max}]`}><AlertTriangle size={11} color="#F44336" /></span>}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Transform frequencies */}
      <div className="border-t px-4 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <button onClick={() => toast.info("Transform", "Create N new numeric variables from code counts")}
          className="flex items-center gap-1 rounded border px-2 py-1 text-[10px] hover:bg-gray-50 min-touch"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <Calculator size={11} /> Transform code frequencies → numeric variables
        </button>
      </div>
    </div>
  );
}

export default VariableEditor;
