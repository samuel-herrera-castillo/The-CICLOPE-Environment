import { useState } from "react";
import { Plus, X, ChevronRight, ArrowLeft, Check } from "lucide-react";
import { useProjectStore, type Category } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { execQuery } from "../../lib/tauriBridge";

interface Props {
  open: boolean;
  category: Category | null;
  onClose: () => void;
}

interface SubCategory {
  id: string; name: string; color: string;
}

interface CitationAssign {
  id: string; text: string; docName: string; assignedTo: number[];
}

const PALETTE = ["#F1D7FF","#2196F3","#4CAF50","#9C27B0","#F1D7FF","#F44336","#00BCD4","#3F51B5"];

export function CategorySplitter({ open, category, onClose }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [subCats, setSubCats] = useState<SubCategory[]>([
    { id: "sub1", name: "", color: PALETTE[0] },
    { id: "sub2", name: "", color: PALETTE[1] },
  ]);
  const [mode, setMode] = useState<"independent" | "child">("independent");
  const [citations] = useState<CitationAssign[]>([]);
  const [assignments, setAssignments] = useState<Record<string, number[]>>({});
  const [currentCitationIdx, setCurrentCitationIdx] = useState(0);
  const addCategory = useProjectStore((s) => s.addCategory);
  const removeCategory = useProjectStore((s) => s.removeCategory);
  const proyectoId = useProjectStore((s) => s.project?.id);
  const { toast } = useToast();

  if (!open || !category) return null;

  const addSubCat = () => {
    setSubCats((prev) => [...prev, { id: `sub${Date.now()}`, name: "", color: PALETTE[prev.length % PALETTE.length] }]);
  };

  const updateSubCat = (id: string, patch: Partial<SubCategory>) => {
    setSubCats((prev) => prev.map((s) => s.id === id ? { ...s, ...patch } : s));
  };

  const removeSubCat = (id: string) => {
    if (subCats.length <= 2) return;
    setSubCats((prev) => prev.filter((s) => s.id !== id));
  };

  const toggleAssignment = (catIdx: number) => {
    const cit = citations[currentCitationIdx];
    setAssignments((prev) => {
      const current = prev[cit.id] ?? [];
      const next = current.includes(catIdx) ? current.filter((n) => n !== catIdx) : [...current, catIdx];
      return { ...prev, [cit.id]: next };
    });
  };

  const handleApply = () => {
    const validCats = subCats.filter((s) => s.name.trim());
    validCats.forEach((sc) => {
      const newId = `c-${Date.now()}-${sc.id}`;
      addCategory({
        id: newId, name: sc.name, color: sc.color,
        parentId: mode === "child" ? category.id : null,
        count: 0,
      });
      // Reassign citations from old category to new sub-category
      if (proyectoId && category.id) {
        execQuery(
          "UPDATE citas_codigos SET codigo_id = ?1 WHERE codigo_id = ?2",
          [newId, category.id]
        ).catch(() => {});
      }
    });
    removeCategory(category.id);
    toast.success("Split", `"${category.name}" divided into ${validCats.length} categories`);
    onClose();
  };

  const currentCit = citations[currentCitationIdx];
  const currentAssigns = assignments[currentCit?.id] ?? [];

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-[800px] rounded-xl shadow-2xl max-h-[90vh] flex flex-col"
        style={{ backgroundColor: "var(--bg-panel)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Split category</h2>
            <p className="text-[10px] opacity-30 mt-0.5">Dividing "{category.name}"</p>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className={step === 1 ? "font-bold text-peach-500" : "opacity-20"}>① New categories</span>
            <span className="opacity-20">→</span>
            <span className={step === 2 ? "font-bold text-peach-500" : "opacity-20"}>② Assign citations</span>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 ? (
            <div className="space-y-4">
              {subCats.map((sc, i) => (
                <div key={sc.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold opacity-20 w-5">{i + 1}.</span>
                  <input value={sc.name} onChange={(e) => updateSubCat(sc.id, { name: e.target.value })}
                    placeholder={`New category ${i + 1}`}
                    className="flex-1 rounded border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                  <input type="color" value={sc.color} onChange={(e) => updateSubCat(sc.id, { color: e.target.value })}
                    className="w-8 h-8 cursor-pointer rounded border" style={{ borderColor: "var(--border)" }} />
                  {subCats.length > 2 && (
                    <button onClick={() => removeSubCat(sc.id)} className="rounded p-1 hover:bg-red-50 text-red-400"><X size={14} /></button>
                  )}
                </div>
              ))}
              <button onClick={addSubCat}
                className="flex items-center gap-1 text-xs hover:opacity-80" style={{ color: "#000" }}>
                <Plus size={12} /> Add another
              </button>

              <div className="border-t pt-3 mt-3" style={{ borderColor: "var(--border)" }}>
                <label className="text-[10px] font-medium opacity-40 block mb-2">Mode</label>
                <div className="flex gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={mode === "independent"} onChange={() => setMode("independent")}
                      style={{ accentColor: "var(--peach)" }} /> Independent categories
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" checked={mode === "child"} onChange={() => setMode("child")}
                      style={{ accentColor: "var(--peach)" }} /> Subcategories (original = parent)
                  </label>
                </div>
              </div>

              <button onClick={() => setStep(2)}
                className="flex items-center gap-1.5 rounded-md bg-peach-500 px-4 py-2 text-sm font-medium text-white hover:bg-peach-700 min-touch">
                Continue <ChevronRight size={14} />
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[10px] opacity-30">Press keys 1, 2, 3... to assign and advance</p>
              <div className="text-xs opacity-30 mb-2">
                {currentCitationIdx + 1} of {citations.length} citations assigned
              </div>

              {/* Citation text */}
              <div className="rounded-lg p-4" style={{ backgroundColor: "var(--bg-secondary)", minHeight: 180 }}>
                <p className="text-sm leading-relaxed italic" style={{ fontFamily: "'Lora', Georgia, serif", color: "var(--text-primary)" }}>
                  &ldquo;{currentCit?.text}&rdquo;
                </p>
                <p className="mt-2 text-[10px] opacity-30">{currentCit?.docName}</p>
              </div>

              {/* Category assignment buttons */}
              <div className="flex gap-2">
                {subCats.filter((s) => s.name.trim()).map((sc, i) => (
                  <button key={sc.id}
                    onClick={() => toggleAssignment(i)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium min-touch ${
                      currentAssigns.includes(i) ? "" : "opacity-60 hover:opacity-100"
                    }`}
                    style={{
                      borderColor: sc.color,
                      backgroundColor: currentAssigns.includes(i) ? sc.color + "20" : "transparent",
                      color: sc.color,
                    }}>
                    {currentAssigns.includes(i) && <Check size={11} />}
                    {i + 1}. {sc.name}
                  </button>
                ))}
                <button onClick={() => setCurrentCitationIdx((i) => Math.min(citations.length - 1, i + 1))}
                  className="rounded-full border px-3 py-1.5 text-xs opacity-30 hover:opacity-60 min-touch"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  Undecided
                </button>
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentCitationIdx((i) => Math.max(0, i - 1))}
                  disabled={currentCitationIdx === 0}
                  className="rounded border px-3 py-1.5 text-xs disabled:opacity-20 min-touch"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  <ArrowLeft size={12} className="inline mr-1" /> Previous
                </button>
                <button onClick={() => setCurrentCitationIdx((i) => Math.min(citations.length - 1, i + 1))}
                  className="rounded border px-3 py-1.5 text-xs min-touch"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  Skip
                </button>
                <div className="flex-1" />
                <button onClick={() => setStep(1)}
                  className="rounded border px-3 py-1.5 text-xs min-touch"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  ← Back
                </button>
                <button onClick={handleApply}
                  className="flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-xs font-medium text-white hover:bg-green-700 min-touch">
                  <Check size={13} /> Apply split
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CategorySplitter;
