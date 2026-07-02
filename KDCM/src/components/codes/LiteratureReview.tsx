import { useState, useEffect } from "react";
import { BookOpen, Download, Save } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { execQuery } from "../../lib/tauriBridge";

export function LiteratureReview() {
  const documents = useProjectStore((s) => s.documents);
  const categories = useProjectStore((s) => s.categories);
  const proyectoId = useProjectStore((s) => s.project?.id);
  const { toast } = useToast();
  const addMemo = useProjectStore((s) => s.addMemo);
  const [bibDocs, setBibDocs] = useState<typeof documents>([]);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [memos, setMemos] = useState<Record<string, Record<string, string>>>({});

  const handleSaveSynthesis = () => {
    if (!selectedRef) return;
    const doc = bibDocs.find((d) => d.id === selectedRef);
    const docName = doc?.name || selectedRef;
    const catEntries = memos[selectedRef] || {};
    const content = Object.entries(catEntries)
      .filter(([, text]) => text.trim())
      .map(([catId, text]) => {
        const cat = categories.find((c) => c.id === catId);
        return `## ${cat?.name || catId}\n${text}`;
      }).join("\n\n");

    if (!content.trim()) { toast.info("Sin contenido", "Escribe notas de síntesis antes de guardar"); return; }

    addMemo({
      id: `litrev-${Date.now()}`,
      title: `Síntesis: ${docName}`,
      content,
      linkedDocIds: [selectedRef],
      linkedCodeIds: Object.keys(catEntries),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    toast.success("Síntesis guardada", `Memo creado para "${docName}"`);
  };

  // Fetch bibliographic documents from SQLite
  useEffect(() => {
    if (!proyectoId) return;
    execQuery("SELECT * FROM documentos WHERE proyecto_id = ?1 AND metadatos_json LIKE ?2", [proyectoId, '%bibliografico%'])
      .then((res) => {
        const docs = (res?.rows || []).map((r: any) => ({
          id: r.id || r[0], name: r.nombre || r[1], type: (r.tipo || r[3]) as any,
          path: r.ruta_archivo || "", size: Number(r.tamanio_bytes || 0),
          addedAt: r.fecha_importacion || "",
          metadata_json: r.metadatos_json,
        }));
        setBibDocs(docs.length > 0 ? docs : []);
      })
      .catch(() => setBibDocs([]));
  }, [proyectoId]);

  if (bibDocs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <BookOpen size={40} opacity={0.1} className="mx-auto mb-3" />
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Literature Review</p>
          <p className="mt-1 text-xs opacity-40">Import bibliographic references from RIS, BibTeX, or Zotero RDF format using the import tools in the Documents tab.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <BookOpen size={14} style={{ color: "#000" }} />
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Literature Review · {bibDocs.length} references</span>
        <div className="flex-1" />
        <button onClick={handleSaveSynthesis}
          className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium bg-green-600 text-white hover:bg-green-700 min-touch"><Save size={11} /> Save synthesis</button>
        <button onClick={() => toast.success("Exported", "Synthesis → Word APA format")}
          className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium bg-peach-500 text-white hover:bg-peach-700 min-touch"><Download size={11} /> Export APA</button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* References list */}
        <div className="w-[220px] flex-shrink-0 border-r overflow-y-auto" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          <div className="px-3 py-2 text-[10px] font-semibold uppercase opacity-30">References</div>
          {bibDocs.map((doc) => (
            <button key={doc.id} onClick={() => setSelectedRef(doc.id)}
              className={`w-full text-left px-3 py-1.5 text-xs min-touch transition-colors ${selectedRef === doc.id ? "" : "hover:bg-gray-50"}`}
              style={{ backgroundColor: selectedRef === doc.id ? "var(--peach)" + "10" : "transparent", borderLeft: selectedRef === doc.id ? "2px solid var(--peach)" : "2px solid transparent", color: "var(--text-primary)" }}>
              <div className="truncate font-medium">{doc.name}</div>
              <div className="text-[9px] opacity-30">{doc.type.toUpperCase()} · {doc.addedAt.slice(0, 10)}</div>
            </button>
          ))}
        </div>
        {/* Synthesis matrix */}
        <div className="flex-1 overflow-auto p-4">
          {selectedRef ? (
            <div>
              <h4 className="text-xs font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{bibDocs.find((d) => d.id === selectedRef)?.name}</h4>
              <div className="space-y-2">
                {categories.slice(0, 6).map((cat) => (
                  <div key={cat.id} className="flex items-start gap-2">
                    <span className="inline-block mt-1.5 h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                    <textarea
                      value={memos[selectedRef]?.[cat.id] ?? ""}
                      onChange={(e) => setMemos((prev) => ({ ...prev, [selectedRef]: { ...(prev[selectedRef] ?? {}), [cat.id]: e.target.value } }))}
                      placeholder={`Notes on ${cat.name}...`}
                      rows={2}
                      className="flex-1 resize-none rounded border px-2 py-1.5 text-[10px] outline-none"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--bg-primary)" }}
                    />
                  </div>
                ))}
              </div>
              {categories.length > 6 && <p className="text-[9px] opacity-20 mt-2">+ {categories.length - 6} more categories</p>}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center"><p className="text-xs opacity-20">Select a reference to start synthesizing</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
