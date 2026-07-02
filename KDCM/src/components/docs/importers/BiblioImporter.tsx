import { useState } from "react";
import { Upload, Download, X, AlertTriangle, FileText } from "lucide-react";
import { useProjectStore } from "../../../stores/projectStore";
import { useToast } from "../../../stores/toastStore";

interface Props { open: boolean; onClose: () => void; }

const ACCEPTED = ".ris,.bib,.rdf,.xml,.enl";

export function BiblioImporter({ open, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [refs, setRefs] = useState<any[]>([]);
  const [importAbstracts, setImportAbstracts] = useState(true);
  const [duplicateModal, setDuplicateModal] = useState<any>(null);
  const addDocument = useProjectStore((s) => s.addDocument);
  const { toast } = useToast();

  if (!open) return null;

  const handleFile = (f: File) => {
    if (!ACCEPTED.split(",").some((ext) => f.name.endsWith(ext.replace(".", "")))) return;
    setFile(f);
    // Read file and parse references
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed: any[] = [];
        // Simple RIS/BibTeX parser — extracts type, authors, title, year
        const lines = text.split(/\r?\n/);
        let current: any = {};
        lines.forEach((line) => {
          const trimmed = line.trim();
          if (/^(TY|@\w+)\s/.test(trimmed)) {
            if (current.title) parsed.push({ ...current });
            current = {};
          }
          if (/^(TI|T1|title\s*=)/i.test(trimmed)) current.title = trimmed.replace(/^(TI|T1|title\s*=)\s*-?\s*/i, "").replace(/[{}]/g, "");
          if (/^(AU|A1|author\s*=)/i.test(trimmed)) current.authors = trimmed.replace(/^(AU|A1|author\s*=)\s*-?\s*/i, "").replace(/[{}]/g, "");
          if (/^(PY|Y1|year\s*=)/i.test(trimmed)) current.year = trimmed.replace(/^(PY|Y1|year\s*=)\s*-?\s*/i, "").replace(/[{}]/g, "").slice(0, 4);
          if (/^(DO|doi\s*=)/i.test(trimmed)) current.doi = trimmed.replace(/^(DO|doi\s*=)\s*-?\s*/i, "").replace(/[{}]/g, "");
        });
        if (current.title) parsed.push(current);
        if (parsed.length > 0) {
          setRefs(parsed.map((p) => ({ type: "article", authors: p.authors || "Unknown", title: p.title || "Untitled", year: p.year || "—", doi: p.doi || "—" })));
        } else {
          toast.info("No references found", "The file may be in an unsupported format. Try RIS or BibTeX.");
        }
      } catch { toast.info("Parse error", "Could not parse the bibliographic file. Check the format."); }
    };
    reader.readAsText(f);
  };

  const handleImport = () => {
    refs.forEach((ref) => {
      addDocument({
        id: `doc-${Date.now()}-bib-${Math.random().toString(36).slice(2, 6)}`,
        name: ref.title, type: "txt", path: file?.name || "", size: file?.size || 0,
        addedAt: new Date().toISOString(),
        metadata_json: JSON.stringify({ tipo: "bibliografico", authors: ref.authors, year: ref.year, doi: ref.doi, type: ref.type }),
      });
    });
    toast.success("Bibliography imported", `✅ ${refs.length} references imported`);
    onClose();
  };

  const handleDuplicateAction = (action: string) => {
    setDuplicateModal(null);
    if (action === "skip") return;
    addDocument({
      id: `doc-${Date.now()}-bib-dup`,
      name: duplicateModal?.title || "Duplicate reference",
      type: "txt", path: file?.name || "", size: file?.size || 0,
      addedAt: new Date().toISOString(),
      metadata_json: JSON.stringify({ tipo: "bibliografico", duplicate_action: action }),
    });
    toast.success("Bibliography imported", "✅ Reference processed");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-xl p-6 shadow-xl" style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold"><FileText size={18} style={{ color: "#000" }} />Bibliographic import</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="mb-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center"
          style={{ borderColor: file ? "var(--peach)" : "var(--border)" }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
          <Upload size={32} opacity={0.3} />
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>Drop .ris, .bib, .rdf, .xml, .enl</p>
          <label className="mt-2 cursor-pointer text-xs underline" style={{ color: "#000" }}>
            or browse
            <input type="file" accept={ACCEPTED} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </label>
        </div>
        {file && <p className="text-xs text-center mb-2" style={{ color: "#000" }}>✓ {file.name}</p>}

        {refs.length > 0 && (
          <>
            <div className="mb-3 max-h-[200px] overflow-y-auto rounded-md border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-[10px]">
                <thead><tr className="border-b opacity-50" style={{ borderColor: "var(--border)" }}>
                  <th className="px-2 py-1 text-left">Type</th><th className="px-2 py-1 text-left">Authors</th><th className="px-2 py-1 text-left">Title</th><th className="px-2 py-1">Year</th><th className="px-2 py-1">DOI/ISBN</th>
                </tr></thead>
                <tbody>{refs.map((r, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: "var(--border)" }}>
                    <td className="px-2 py-1 opacity-60">{r.type}</td>
                    <td className="px-2 py-1 max-w-[80px] truncate">{r.authors}</td>
                    <td className="px-2 py-1 max-w-[120px] truncate font-medium">{r.title}</td>
                    <td className="px-2 py-1 text-center">{r.year}</td>
                    <td className="px-2 py-1 text-center opacity-40">{r.doi || "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <label className="mb-3 flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={importAbstracts} onChange={(e) => setImportAbstracts(e.target.checked)} style={{ accentColor: "var(--peach)" }} />
              Import abstracts as document content
            </label>
            <button onClick={handleImport} className="flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium text-white hover:opacity-80 min-touch"
              style={{ backgroundColor: "var(--peach)" }}><Download size={14} /> Import {refs.length} references</button>
          </>
        )}

        {duplicateModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={() => setDuplicateModal(null)}>
            <div className="w-80 rounded-xl p-5 shadow-xl" style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}>
              <div className="flex items-center gap-2 mb-3"><AlertTriangle size={18} style={{ color: "#FF9800" }} /><p className="text-sm font-semibold">Duplicate detected</p></div>
              <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>"{duplicateModal?.title}" already exists. What would you like to do?</p>
              <div className="flex gap-2">
                <button onClick={() => handleDuplicateAction("merge")} className="flex-1 rounded-md py-1.5 text-xs font-medium text-white" style={{ backgroundColor: "var(--peach)" }}>Merge</button>
                <button onClick={() => handleDuplicateAction("new")} className="flex-1 rounded-md border py-1.5 text-xs" style={{ borderColor: "var(--border)" }}>Import as new</button>
                <button onClick={() => handleDuplicateAction("skip")} className="flex-1 rounded-md border py-1.5 text-xs" style={{ borderColor: "var(--border)" }}>Skip</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default BiblioImporter;
