import { useState } from "react";
import { X, Plus, Trash2, Save, RotateCcw } from "lucide-react";
import { useToast } from "../../stores/toastStore";

interface RelationType {
  id: string;
  name: string;
  shortName: string;
  symbol: string;
  property: "symmetric" | "asymmetric_transitive" | "asymmetric_nontransitive" | "undirected";
  color: string;
  width: number;
  style: string;
  editable: boolean;
  deletable: boolean;
}

const PRESETS: RelationType[] = [
  { id: "rt1", name: "is cause of", shortName: "causes", symbol: "→", property: "asymmetric_transitive", color: "#E53935", width: 2, style: "solid", editable: true, deletable: false },
  { id: "rt2", name: "is associated with", shortName: "associated", symbol: "↔", property: "symmetric", color: "#1E88E5", width: 2, style: "solid", editable: true, deletable: false },
  { id: "rt3", name: "contradicts", shortName: "contr.", symbol: "≠", property: "asymmetric_nontransitive", color: "#F4511E", width: 2, style: "dashed", editable: true, deletable: false },
  { id: "rt4", name: "is part of", shortName: "part of", symbol: "⊂", property: "asymmetric_transitive", color: "#43A047", width: 2, style: "solid", editable: true, deletable: false },
  { id: "rt5", name: "is a type of", shortName: "type of", symbol: "⊆", property: "asymmetric_transitive", color: "#8E24AA", width: 2, style: "solid", editable: true, deletable: false },
  { id: "rt6", name: "relates to", shortName: "related", symbol: "~", property: "undirected", color: "#6D4C41", width: 1, style: "dotted", editable: true, deletable: false },
];

const LINE_STYLES = ["solid","dashed","dotted","dashdot","double","thick","wavy","chained"];
const STYLE_LABELS: Record<string,string> = { solid:"Continuous",dashed:"Dashed",dotted:"Dotted",dashdot:"Dash-dot",double:"Double",thick:"Thick",wavy:"Wavy",chained:"Chained" };

interface Props { onClose: () => void; onSaveTypes?: (types: RelationType[]) => void; }

export function RelationTypeAdmin({ onClose, onSaveTypes }: Props) {
  const [types, setTypes] = useState<RelationType[]>(PRESETS);
  const { toast } = useToast();

  const addType = () => {
    const t: RelationType = { id: "rt-"+Date.now(), name: "", shortName: "", symbol: "", property: "undirected", color: "#F1D7FF", width: 2, style: "solid", editable: true, deletable: true };
    setTypes(p => [...p, t]);
  };

  const updateType = (id: string, patch: Partial<RelationType>) => {
    setTypes(p => p.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const deleteType = (id: string) => {
    const t = types.find(tt => tt.id === id);
    if (t && !t.deletable) { toast.info("Cannot delete", "Preset relations cannot be deleted"); return; }
    setTypes(p => p.filter(tt => tt.id !== id));
    toast.success("Deleted", "Relation type removed");
  };

  const handleSave = () => {
    onSaveTypes?.(types);
    toast.success("Saved", "Relation types updated");
  };

  const handleRestore = () => { setTypes(PRESETS); toast.info("Restored", "Defaults restored"); };

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[900px] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}
        style={{ backgroundColor: "var(--bg-primary)" }}>
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>⚙ Relation type manager</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: "var(--border)" }}>
                <th className="py-1.5 px-1 font-medium opacity-40">Name</th>
                <th className="py-1.5 px-1 font-medium opacity-40">Short</th>
                <th className="py-1.5 px-1 font-medium opacity-40">Sym</th>
                <th className="py-1.5 px-1 font-medium opacity-40">Property</th>
                <th className="py-1.5 px-1 font-medium opacity-40">Color</th>
                <th className="py-1.5 px-1 font-medium opacity-40">W</th>
                <th className="py-1.5 px-1 font-medium opacity-40">Style</th>
                <th className="py-1.5 px-1 font-medium opacity-40 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {types.map(t => (
                <tr key={t.id} className="border-b hover:bg-gray-50" style={{ borderColor: "var(--border)" }}>
                  <td className="py-1 px-1">
                    <input value={t.name} onChange={e => updateType(t.id, { name: e.target.value })}
                      className="w-full rounded border px-1.5 py-0.5 text-[10px] outline-none"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} placeholder="Name" />
                  </td>
                  <td className="py-1 px-1">
                    <input value={t.shortName} onChange={e => updateType(t.id, { shortName: e.target.value })}
                      className="w-[60px] rounded border px-1.5 py-0.5 text-[10px] outline-none"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} placeholder="Short" />
                  </td>
                  <td className="py-1 px-1">
                    <input value={t.symbol} onChange={e => updateType(t.id, { symbol: e.target.value })}
                      className="w-[36px] rounded border px-1 py-0.5 text-[10px] text-center outline-none"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                  </td>
                  <td className="py-1 px-1">
                    <select value={t.property} onChange={e => updateType(t.id, { property: e.target.value as any })}
                      className="rounded border px-1 py-0.5 text-[9px] outline-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      <option value="symmetric">Symmetric</option>
                      <option value="asymmetric_transitive">Asym. trans.</option>
                      <option value="asymmetric_nontransitive">Asym. non-trans.</option>
                      <option value="undirected">Undirected</option>
                    </select>
                  </td>
                  <td className="py-1 px-1">
                    <input type="color" value={t.color} onChange={e => updateType(t.id, { color: e.target.value })}
                      className="w-6 h-5 cursor-pointer rounded border" />
                  </td>
                  <td className="py-1 px-1">
                    <input type="number" min={1} max={8} value={t.width} onChange={e => updateType(t.id, { width: parseInt(e.target.value) || 2 })}
                      className="w-10 rounded border px-1 py-0.5 text-[9px] outline-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                  </td>
                  <td className="py-1 px-1">
                    <select value={t.style} onChange={e => updateType(t.id, { style: e.target.value })}
                      className="rounded border px-1 py-0.5 text-[9px] outline-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      {LINE_STYLES.map(s => <option key={s} value={s}>{STYLE_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td className="py-1 px-1">
                    <button onClick={() => deleteType(t.id)} disabled={!t.deletable}
                      className="rounded p-0.5 hover:bg-red-50 disabled:opacity-20" title={t.deletable ? "Delete" : "Preset (cannot delete)"}>
                      <Trash2 size={10} className="text-red-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addType} className="mt-3 flex items-center gap-1 text-[10px] font-medium hover:opacity-70" style={{ color: "#000" }}>
            <Plus size={11} /> New relation type
          </button>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <button onClick={handleRestore} className="flex items-center gap-1 rounded px-3 py-1.5 text-[11px] font-medium hover:bg-gray-100 min-touch" style={{ color: "var(--text-secondary)" }}>
            <RotateCcw size={12} /> Restore defaults
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded border px-3 py-1.5 text-[11px] font-medium hover:bg-gray-50 min-touch"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={handleSave} className="flex items-center gap-1 rounded bg-peach-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-peach-700 min-touch">
              <Save size={12} /> Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export type { RelationType };
export { PRESETS };
