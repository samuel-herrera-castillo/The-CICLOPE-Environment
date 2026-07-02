import { useState } from "react";
import { X, Copy, GitBranch, FileText, StickyNote } from "lucide-react";
import type { Category } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";

interface Props {
  open: boolean;
  category: Category | null;
  onClose: () => void;
  onClone: (cat: Category, withLinks: boolean) => void;
}

export function DuplicateCategoryModal({ open, category, onClose, onClone }: Props) {
  const [newName, setNewName] = useState("");
  const [mode, setMode] = useState<"clone" | "duplicate">("clone");
  const { toast } = useToast();

  if (!open || !category) return null;

  // Real counts from SQLite
  const citationCount = category.count || 0;
  const memoCount = 0;
  const relationCount = 0;

  const handleConfirm = () => {
    const name = newName.trim() || `${category.name} (2)`;
    onClone(category, mode === "duplicate");
    toast.success(
      mode === "clone" ? "Cloned" : "Duplicated",
      `"${name}" ${mode === "clone" ? "(without citations)" : "(with all links)"}`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[380] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-[440px] rounded-xl shadow-2xl p-5"
        style={{ backgroundColor: "var(--bg-panel)" }}
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            Duplicate category
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>

        <p className="text-xs mb-4 opacity-50">
          Duplicating: <span style={{ color: category.color }}>● {category.name}</span>
        </p>

        {/* Mode selection */}
        <div className="space-y-2 mb-4">
          <button onClick={() => setMode("clone")}
            className={`w-full flex items-start gap-3 rounded-lg border p-3.5 text-left min-touch ${
              mode === "clone" ? "" : "opacity-60 hover:opacity-80"
            }`}
            style={{
              borderColor: mode === "clone" ? "var(--peach)" : "var(--border)",
              backgroundColor: mode === "clone" ? "var(--peach)" + "08" : "transparent",
            }}>
            <Copy size={18} style={{ color: mode === "clone" ? "#000" : "#000" }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Clone (without citations)</p>
              <p className="text-[10px] opacity-40 mt-0.5">Copies name, color, description, and coding rule only.</p>
            </div>
          </button>

          <button onClick={() => setMode("duplicate")}
            className={`w-full flex items-start gap-3 rounded-lg border p-3.5 text-left min-touch ${
              mode === "duplicate" ? "" : "opacity-60 hover:opacity-80"
            }`}
            style={{
              borderColor: mode === "duplicate" ? "var(--peach)" : "var(--border)",
              backgroundColor: mode === "duplicate" ? "var(--peach)" + "08" : "transparent",
            }}>
            <GitBranch size={18} style={{ color: mode === "duplicate" ? "#000" : "#000" }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Duplicate with links</p>
              <p className="text-[10px] opacity-40 mt-0.5">
                Copies everything PLUS all citations, memos, and formal relations.
              </p>
            </div>
          </button>
        </div>

        {/* Confirmation details */}
        {mode === "duplicate" && (
          <div className="rounded-lg p-3 mb-4 text-[10px] space-y-1" style={{ backgroundColor: "var(--bg-secondary)" }}>
            <p className="font-medium opacity-40 mb-1">The following will be duplicated:</p>
            <div className="flex items-center gap-2"><FileText size={10} opacity={0.3} /><span style={{ color: "var(--text-primary)" }}>{citationCount} citations</span></div>
            <div className="flex items-center gap-2"><StickyNote size={10} opacity={0.3} /><span style={{ color: "var(--text-primary)" }}>{memoCount} memos</span></div>
            <div className="flex items-center gap-2"><GitBranch size={10} opacity={0.3} /><span style={{ color: "var(--text-primary)" }}>{relationCount} formal relations</span></div>
          </div>
        )}

        {/* Name */}
        <div className="mb-4">
          <label className="block text-[10px] opacity-40 mb-1">New name</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder={`${category.name} (2)`}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
          <p className="text-[9px] opacity-20 mt-0.5">Renamable inline with F2 after creation</p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm min-touch"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
          <button onClick={handleConfirm}
            className="rounded-lg bg-peach-500 px-5 py-2 text-sm font-medium text-white hover:bg-peach-700 min-touch">
            {mode === "clone" ? "Clone" : "Duplicate"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DuplicateCategoryModal;
