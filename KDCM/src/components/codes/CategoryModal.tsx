import { useState, useEffect, useRef } from "react";
import { X, Trash2 } from "lucide-react";
import type { Category } from "../../stores/projectStore";

interface Props {
  open: boolean;
  category: Category | null;
  categories: Category[];
  onClose: () => void;
  onSave: (data: Partial<Category>) => void;
  onDelete: (id: string) => void;
}

const PALETTE = [
  "#F1D7FF","#2196F3","#4CAF50","#9C27B0","#F1D7FF","#00BCD4",
  "#F44336","#3F51B5","#009688","#795548","#607D8B","#E91E63",
  "#CDDC39","#FF5722","#8BC34A","#03A9F4","#FFC107","#673AB7",
  "#26A69A","#EC407A","#AB47BC","#29B6F6","#66BB6A","#FFA726",
];

export function CategoryModal({ open, category, categories, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [description, setDescription] = useState("");
  const [codingRule, setCodingRule] = useState("");
  const [exampleCitation, setExampleCitation] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [freeNode, setFreeNode] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const isEditing = category !== null;

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setColor(category?.color ?? PALETTE[0]);
    setDescription(category?.description ?? "");
    setCodingRule((category as any)?.coding_rule ?? "");
    setExampleCitation((category as any)?.example_citation ?? "");
    setParentId(category?.parentId ?? null);
    setFreeNode((category as any)?.es_nodo_libre ?? false);
    setTimeout(() => nameRef.current?.focus(), 50);
  }, [open, category]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[560px] rounded-xl p-6 shadow-xl"
        style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold">{isEditing ? "Edit category" : "New category"}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Name * <span className="opacity-40 font-normal">{name.length}/120</span>
            </label>
            <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
          </div>

          {/* Color palette */}
          <div>
            <label className="mb-1.5 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Color</label>
            <div className="flex flex-wrap gap-1.5">
              {PALETTE.map((c) => (
                <button key={c} onClick={() => setColor(c)}
                  className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: color === c ? "var(--text-primary)" : "transparent" }} />
              ))}
              <label className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-dashed opacity-40 hover:opacity-80"
                style={{ borderColor: "var(--border)" }} title="Custom color">
                🎨
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="hidden" />
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full resize-none rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
          </div>

          {/* Coding rule */}
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Coding rule</label>
            <input value={codingRule} onChange={(e) => setCodingRule(e.target.value)}
              placeholder="e.g. 'Must include a value judgment about the policy'"
              className="w-full rounded-md border px-3 py-2 text-xs outline-none"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
          </div>

          {/* Example citation */}
          <div>
            <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Example citation</label>
            <input value={exampleCitation} onChange={(e) => setExampleCitation(e.target.value)}
              placeholder="A short example segment that fits this code"
              className="w-full rounded-md border px-3 py-2 text-xs outline-none"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
          </div>

          {/* Parent + free node */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Parent category</label>
              <select value={parentId ?? ""} onChange={(e) => setParentId(e.target.value || null)}
                className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                <option value="">— None (top level)</option>
                {categories.filter((c) => c.id !== category?.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 pt-5 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={freeNode} onChange={(e) => setFreeNode(e.target.checked)}
                style={{ accentColor: "var(--peach)" }} />
              Free node
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between">
          {isEditing ? (
            <button onClick={() => { onDelete(category!.id); onClose(); }}
              className="flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 min-touch">
              <Trash2 size={13} /> Delete
            </button>
          ) : <div />}

          <div className="flex gap-2">
            <button onClick={onClose}
              className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50 min-touch"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>Cancel</button>
            <button onClick={() => { onSave({ name, color, description, parentId }); onClose(); }}
              disabled={!name.trim()}
              className="rounded-md bg-peach-500 px-5 py-2 text-sm font-medium text-white hover:bg-peach-700 disabled:opacity-40 min-touch">
              {isEditing ? "Save changes" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CategoryModal;
