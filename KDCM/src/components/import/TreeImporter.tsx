import { useState } from "react";
import { Upload, Download, X } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";

interface Props { open: boolean; onClose: () => void; }

export function TreeImporter({ open, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ name: string; parent: string; color: string; definition: string }[]>([]);
  const addCategory = useProjectStore((s) => s.addCategory);
  const { toast } = useToast();
  if (!open) return null;

  const parseCSV = async (f: File) => {
    setFile(f);
    try {
      const text = await f.text();
      const lines = text.split("\n").filter(l => l.trim() && !l.startsWith("#"));
      const rows: { name: string; parent: string; color: string; definition: string }[] = [];
      for (let i = 1; i < Math.min(lines.length, 50); i++) {
        const cols = lines[i].split(/[,\t]/);
        if (cols.length >= 2) {
          rows.push({ name: cols[0]?.trim() || "", parent: cols[1]?.trim() || "", color: cols[2]?.trim() || "#9b59b6", definition: cols[3]?.trim() || "" });
        }
      }
      setPreview(rows);
      if (rows.length === 0) toast.warning("No data", "No valid rows found in the file");
    } catch { toast.error("Error", "Could not parse the file. Use CSV format: name, parent, color, definition"); }
  };

  const handleImport = () => {
    if (preview.length === 0) return;
    preview.forEach((row, i) => {
      const parentCat = preview.find(r => r.name === row.parent);
      addCategory({ id: `cat-csv-${Date.now()}-${i}`, name: row.name, color: row.color, parentId: parentCat ? `cat-csv-${Date.now()}-${preview.indexOf(parentCat)}` : null, description: row.definition, count: 0 });
    });
    toast.success("Imported", `${preview.length} categories created`);
    onClose();
  };

  const downloadTemplate = () => {
    const csv = "name,parent,color,definition\nResistance,,#F44336,Opposition to change\nPassive resistance,Resistance,#EF5350,Non-confrontational opposition\nAdaptation,,#4CAF50,Adjustment strategies";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "kdcm_categories_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-xl p-6 shadow-xl" style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">📊 Import Categories (CSV)</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <p className="mb-2 text-xs opacity-50">CSV format: <code>name, parent, color, definition</code></p>
        <button onClick={downloadTemplate} className="mb-3 flex items-center gap-1 text-xs underline opacity-50 hover:opacity-80"><Download size={11}/> Download template</button>
        <div className="mb-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center"
          style={{ borderColor: file ? "#9b59b6" : "var(--border)" }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parseCSV(f); }}>
          <Upload size={32} opacity={0.3} />
          <p className="mt-2 text-sm">Drop CSV file here</p>
          <label className="mt-2 cursor-pointer text-xs underline" style={{ color: "#9b59b6" }}>
            or browse
            <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseCSV(f); }} />
          </label>
        </div>
        {preview.length > 0 && (
          <div className="mb-4 max-h-[200px] overflow-y-auto rounded-md border p-2" style={{ borderColor: "var(--border)" }}>
            <p className="mb-1 text-[10px] opacity-40">{preview.length} categories detected:</p>
            {preview.slice(0, 10).map((r, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5 text-xs">
                <span style={{ color: r.color }}>●</span>
                <span className="font-medium">{r.name}</span>
                {r.parent && <span className="opacity-30">← {r.parent}</span>}
              </div>
            ))}
            {preview.length > 10 && <p className="text-[10px] opacity-30">...and {preview.length - 10} more</p>}
          </div>
        )}
        {preview.length > 0 && (
          <button onClick={handleImport} className="flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium text-white hover:opacity-90" style={{ backgroundColor: "#9b59b6" }}>
            <Download size={14} /> Import {preview.length} categories
          </button>
        )}
      </div>
    </div>
  );
}
export default TreeImporter;
