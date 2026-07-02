import { useState } from "react";
import {
  Plus, Save, Trash2, ArrowRight, ArrowLeftRight,
} from "lucide-react";
import { useToast } from "../../stores/toastStore";

/* ── Types ── */

interface RelationType {
  id: string;
  name: string;
  shortName: string;
  symbol: string;
  directed: boolean;
  color: string;
  thickness: number;
}

const PRELOADED: RelationType[] = [
  { id: "rt1", name: "Causes", shortName: "causes", symbol: "→", directed: true, color: "#E53935", thickness: 2 },
  { id: "rt2", name: "Is associated with", shortName: "assoc.", symbol: "↔", directed: false, color: "#1E88E5", thickness: 1 },
  { id: "rt3", name: "Contradicts", shortName: "contra.", symbol: "≠", directed: true, color: "#F4511E", thickness: 2 },
  { id: "rt4", name: "Is part of", shortName: "part of", symbol: "⊂", directed: true, color: "#43A047", thickness: 1 },
  { id: "rt5", name: "Is a type of", shortName: "type of", symbol: "⊆", directed: true, color: "#8E24AA", thickness: 1 },
  { id: "rt6", name: "Relates to", shortName: "related", symbol: "~", directed: false, color: "#6D4C41", thickness: 1 },
];

/* ── Component ── */

export function RelationTypeManager() {
  const [types, setTypes] = useState<RelationType[]>(PRELOADED);
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const { toast } = useToast();

  const addType = () => {
    setTypes((prev) => [...prev, {
      id: `rt-${Date.now()}`, name: "New relation", shortName: "new",
      symbol: "→", directed: true, color: "#9E9E9E", thickness: 1,
    }]);
    toast.success("Added", "New relation type added");
  };

  const startEdit = (id: string, field: string, current: string) => {
    setEditingCell({ id, field });
    setEditValue(current);
  };

  const commitEdit = () => {
    if (!editingCell) return;
    setTypes((prev) => prev.map((t) => t.id === editingCell.id
      ? { ...t, [editingCell.field]: editingCell.field === "thickness" ? Number(editValue) || 1 : editingCell.field === "directed" ? editValue === "true" : editValue }
      : t));
    setEditingCell(null);
  };

  const deleteType = (id: string) => {
    setTypes((prev) => prev.filter((t) => t.id !== id));
    toast.success("Deleted", "Relation type removed");
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Relation types</h2>
        <div className="flex-1" />
        <button onClick={addType}
          className="flex items-center gap-1.5 rounded-md bg-peach-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-peach-700 min-touch">
          <Plus size={12} /> New type
        </button>
        <button onClick={() => toast.success("Saved", "Relation types saved")}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50 min-touch"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <Save size={12} /> Save
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
              {["Name","Short","Symbol","Directed","Color","Thickness",""].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium opacity-40" style={{ color: "var(--text-secondary)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id} className="border-b hover:bg-gray-50" style={{ borderColor: "var(--border)" }}>
                {/* Name */}
                <td className="px-3 py-2" onDoubleClick={() => startEdit(t.id, "name", t.name)}>
                  {editingCell?.id === t.id && editingCell.field === "name" ? (
                    <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit} onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null); }}
                      className="w-full rounded border px-1.5 py-0.5 text-xs outline-none"
                      style={{ borderColor: "var(--peach)", color: "var(--text-primary)" }} />
                  ) : (
                    <span className="font-medium" style={{ color: "var(--text-primary)", cursor: "text" }}>{t.name}</span>
                  )}
                </td>
                {/* Short name */}
                <td className="px-3 py-2" onDoubleClick={() => startEdit(t.id, "shortName", t.shortName)}
                  style={{ color: "var(--text-secondary)", cursor: "text" }}>{t.shortName}</td>
                {/* Symbol */}
                <td className="px-3 py-2 text-center text-lg" style={{ color: t.color }}>{t.symbol}</td>
                {/* Directed */}
                <td className="px-3 py-2 text-center">
                  {t.directed ? <ArrowRight size={14} style={{ color: t.color }} /> : <ArrowLeftRight size={14} style={{ color: t.color }} />}
                </td>
                {/* Color */}
                <td className="px-3 py-2">
                  <input type="color" value={t.color} onChange={(e) => setTypes((prev) => prev.map((r) => r.id === t.id ? { ...r, color: e.target.value } : r))}
                    className="w-7 h-6 cursor-pointer rounded border" style={{ borderColor: "var(--border)" }} />
                </td>
                {/* Thickness */}
                <td className="px-3 py-2" style={{ color: "var(--text-secondary)" }}>
                  <input type="range" min={1} max={5} value={t.thickness}
                    onChange={(e) => setTypes((prev) => prev.map((r) => r.id === t.id ? { ...r, thickness: Number(e.target.value) } : r))}
                    className="w-16" style={{ accentColor: t.color }} />
                </td>
                {/* Actions */}
                <td className="px-3 py-2">
                  <button onClick={() => deleteType(t.id)} className="rounded p-1 hover:bg-red-50 text-red-400"><Trash2 size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RelationTypeManager;
