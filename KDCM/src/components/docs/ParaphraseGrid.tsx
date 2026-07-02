import { useState } from "react";
import { Eye, EyeOff, Plus, Settings, GripHorizontal } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";

export function ParaphraseGrid() {
  const documents = useProjectStore((s) => s.documents);
  const categories = useProjectStore((s) => s.categories);
  const { toast } = useToast();
  const [showOriginal, setShowOriginal] = useState(false);
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});

  // Simple demo data
  const [paraphrases, setParaphrases] = useState<Record<string, Record<string, string>>>({});

  const updateParaphrase = (docId: string, catId: string, text: string) => {
    setParaphrases((prev) => ({
      ...prev,
      [docId]: { ...(prev[docId] ?? {}), [catId]: text },
    }));
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Paraphrase matrix</h2>
        <button onClick={() => setShowOriginal((o) => !o)}
          className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] min-touch ${showOriginal ? "bg-peach-100" : "hover:bg-gray-100"}`}
          style={{ color: showOriginal ? "#000" : "#000" }}>
          {showOriginal ? <Eye size={12} /> : <EyeOff size={12} />} {showOriginal ? "Original" : "Paraphrase"}
        </button>
        <div className="flex-1" />
        <button onClick={() => toast.info("Add document", "Import a document first, then return to paraphrase it")}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-secondary)" }}>
          <Plus size={12} /> Add document
        </button>
        <button onClick={() => toast.info("Add category", "Create categories in the Codes panel to organize paraphrases")}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-secondary)" }}>
          <Plus size={12} /> Add category
        </button>
        <button onClick={() => toast.info("Configure", "Paraphrase grid settings: adjust columns, sorting, and filters")}
          className="rounded p-1 hover:bg-gray-100 min-touch" title="Configure"><Settings size={14} opacity={0.4} /></button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
              <th className="sticky left-0 border-r px-3 py-2 text-left font-medium w-[120px]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-secondary)" }}>Document ↓ / Category →</th>
              {categories.slice(0, 4).map((cat) => (
                <th key={cat.id} className="border-r px-3 py-2 text-left font-medium min-w-[200px]" style={{ borderColor: "var(--border)", color: cat.color }}>
                  ● {cat.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {documents.slice(0, 3).map((doc) => (
              <tr key={doc.id} className="border-b" style={{ borderColor: "var(--border)" }}>
                <td className="sticky left-0 border-r px-3 py-2 font-medium" style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--bg-panel)" }}>{doc.name}</td>
                {categories.slice(0, 4).map((cat) => {
                  const key = `${doc.id}-${cat.id}`;
                  const height = rowHeights[key] ?? 80;
                  return (
                    <td key={cat.id} className="border-r px-2 py-1" style={{ borderColor: "var(--border)" }}>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {[1, 2].map((n) => (
                          <span key={n} className="rounded-full bg-peach-100 px-1.5 py-0 text-[9px] text-peach-700">segment {n}</span>
                        ))}
                      </div>
                      <textarea
                        value={paraphrases[doc.id]?.[cat.id] ?? ""}
                        onChange={(e) => updateParaphrase(doc.id, cat.id, e.target.value)}
                        placeholder="Write paraphrase..."
                        className="w-full resize-none rounded border-0 bg-transparent text-[11px] outline-none"
                        style={{ height, maxHeight: 400, color: "var(--text-primary)", fontFamily: "'Lora', Georgia, serif" }}
                      />
                      <div className="flex justify-center mt-0.5 cursor-ns-resize opacity-20 hover:opacity-60"
                        onMouseDown={(e) => {
                          const startY = e.clientY;
                          const startH = height;
                          const onMove = (ev: MouseEvent) => {
                            setRowHeights((prev) => ({ ...prev, [key]: Math.max(60, startH + (ev.clientY - startY)) }));
                          };
                          const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
                          document.addEventListener("mousemove", onMove);
                          document.addEventListener("mouseup", onUp);
                        }}>
                        <GripHorizontal size={14} />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ParaphraseGrid;
