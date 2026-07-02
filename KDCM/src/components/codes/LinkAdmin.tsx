import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, X, Link, Pencil, ExternalLink, ArrowRight, ArrowLeft, Download } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { getLinks, saveLink, deleteLink, getCitations } from "../../lib/tauriBridge";
import { EmptyState } from "../ui/EmptyState";

interface LinkRecord {
  id: string;
  origen_id: string;
  destino_id: string;
  etiqueta: string | null;
  investigador_id: string | null;
  fecha: string;
  texto_origen?: string;
  texto_destino?: string;
}

interface Props { open: boolean; onClose: () => void; }

export function LinkAdmin({ open, onClose }: Props) {
  const project = useProjectStore((s) => s.project);
  const setSelectedDocId = useLayoutStore((s) => s.setSelectedDocId);
  const setPestañaPrincipal = useLayoutStore((s) => s.setPestañaPrincipal);
  const [links, setLinks] = useState<LinkRecord[]>([]);
  const [search, setSearch] = useState("");
  const [filterInvestigador, setFilterInvestigador] = useState("");
  const [filterDocumento, setFilterDocumento] = useState("");
  const [filterFechaDesde, setFilterFechaDesde] = useState("");
  const [filterFechaHasta, setFilterFechaHasta] = useState("");
  const [selectedLink, setSelectedLink] = useState<LinkRecord | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { toast } = useToast();

  const loadLinks = useCallback(async () => {
    if (!project) return;
    try {
      const result = await getLinks(project.id);
      setLinks((result?.rows || []) as LinkRecord[]);
    } catch { /* backend not available */ }
  }, [project]);

  useEffect(() => { if (open) loadLinks(); }, [open, loadLinks]);

  if (!open) return null;

  // Build unique researcher and document lists for filters
  const investigadores = [...new Set(links.map((l) => l.investigador_id).filter(Boolean))] as string[];
  const documentos = [...new Set([...links.map((l) => l.texto_origen || ""), ...links.map((l) => l.texto_destino || "")].filter(Boolean))] as string[];

  const filtered = links.filter((l) => {
    if (search && !(l.etiqueta || "").toLowerCase().includes(search.toLowerCase()) &&
        !(l.texto_origen || "").toLowerCase().includes(search.toLowerCase()) &&
        !(l.texto_destino || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterInvestigador && l.investigador_id !== filterInvestigador) return false;
    if (filterDocumento && !(l.texto_origen || "").includes(filterDocumento) && !(l.texto_destino || "").includes(filterDocumento)) return false;
    if (filterFechaDesde && l.fecha && l.fecha < filterFechaDesde) return false;
    if (filterFechaHasta && l.fecha && l.fecha > filterFechaHasta) return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) { setDeleteConfirm(id); return; }
    try { await deleteLink(id); setLinks((prev) => prev.filter((l) => l.id !== id)); toast.success("Link deleted"); setDeleteConfirm(null); } catch { toast.error("Error", "Could not delete link"); }
  };

  const handleSaveLabel = async (id: string) => {
    const link = links.find((l) => l.id === id);
    if (!link) return;
    try {
      await saveLink(id, project?.id || "", link.origen_id, link.destino_id, editValue, link.investigador_id);
      setLinks((prev) => prev.map((l) => l.id === id ? { ...l, etiqueta: editValue } : l));
      setEditingLabel(null);
    } catch { toast.error("Error", "Could not update label"); }
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "var(--border)" }}>
        <h2 className="text-sm font-semibold flex items-center gap-2"><Link size={16} style={{ color: "#000" }} />Links between segments</h2>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search links..."
            className="w-[140px] rounded border px-2 py-1 text-xs outline-none" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }} />
          {/* Filter dropdowns */}
          <select value={filterInvestigador} onChange={(e) => setFilterInvestigador(e.target.value)}
            className="rounded border px-1 py-1 text-[10px] outline-none" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <option value="">All researchers</option>
            {investigadores.map((inv) => <option key={inv} value={inv}>{inv.slice(0, 20)}</option>)}
          </select>
          <select value={filterDocumento} onChange={(e) => setFilterDocumento(e.target.value)}
            className="rounded border px-1 py-1 text-[10px] outline-none" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <option value="">All documents</option>
            {documentos.slice(0, 20).map((doc) => <option key={doc} value={doc}>{doc.slice(0, 30)}</option>)}
          </select>
          <input type="date" value={filterFechaDesde} onChange={(e) => setFilterFechaDesde(e.target.value)}
            className="rounded border px-1 py-0.5 text-[9px] outline-none w-[105px]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }} title="Desde" />
          <input type="date" value={filterFechaHasta} onChange={(e) => setFilterFechaHasta(e.target.value)}
            className="rounded border px-1 py-0.5 text-[9px] outline-none w-[105px]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }} title="Hasta" />
          <button onClick={() => setShowNewModal(true)} className="flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-white hover:opacity-80" style={{ backgroundColor: "var(--peach)" }}><Plus size={12} /> New</button>
          <button onClick={() => {
            const csv = "Origen,Etiqueta,Destino,Investigador,Fecha\n" + links.map((l) => `"${(l.texto_origen || "").slice(0, 50)}","${l.etiqueta || ""}","${(l.texto_destino || "").slice(0, 50)}","${l.investigador_id || ""}","${l.fecha || ""}"`).join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = "kdcm_links.csv"; a.click();
            URL.revokeObjectURL(url); toast.success("Exported", "Links exported to CSV");
          }} className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium hover:bg-gray-100 min-touch" style={{ color: "var(--text-secondary)" }}><Download size={12} /> Excel</button>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={14} /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Table */}
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <EmptyState variant="no-results" title="No links" subtitle="Create a link between two segments" />
          ) : (
            <table className="w-full text-xs">
              <thead><tr className="border-b text-left sticky top-0" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
                <th className="px-3 py-2 font-medium">Origin</th><th className="px-3 py-2 font-medium">→ Label</th><th className="px-3 py-2 font-medium">Destination</th><th className="px-3 py-2 font-medium">Researcher</th><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium w-24">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((link) => (
                  <tr key={link.id} onClick={() => setSelectedLink(link)}
                    className={`border-b cursor-pointer transition-colors ${selectedLink?.id === link.id ? "" : "hover:bg-gray-50"}`}
                    style={{ borderColor: "var(--border)", backgroundColor: selectedLink?.id === link.id ? "rgba(241, 215, 255, 0.2)" : "transparent" }}>
                    <td className="px-3 py-1.5 max-w-[160px] truncate">{(link.texto_origen || link.origen_id).slice(0, 50)}</td>
                    <td className="px-3 py-1.5">
                      {editingLabel === link.id ? (
                        <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => handleSaveLabel(link.id)} onKeyDown={(e) => { if (e.key === "Enter") handleSaveLabel(link.id); if (e.key === "Escape") setEditingLabel(null); }}
                          className="w-24 rounded border px-1 py-0 text-[11px]" style={{ borderColor: "var(--peach)" }} />
                      ) : (
                        <span className="flex items-center gap-1 font-medium" style={{ color: "#000" }}>
                          → {link.etiqueta || "linked to"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 max-w-[160px] truncate">{(link.texto_destino || link.destino_id).slice(0, 50)}</td>
                    <td className="px-3 py-1.5 opacity-50 max-w-[100px] truncate">{link.investigador_id || "—"}</td>
                    <td className="px-3 py-1.5 opacity-50 whitespace-nowrap">{link.fecha?.slice(0, 10)}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex gap-0.5">
                        <button onClick={(e) => { e.stopPropagation(); setSelectedDocId(link.origen_id); setPestañaPrincipal("documentos"); toast.info("Navigating", "Opening origin document"); }}
                          className="rounded p-1 hover:bg-gray-100" title="→ Ir al origen"><ArrowRight size={11} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setSelectedDocId(link.destino_id); setPestañaPrincipal("documentos"); toast.info("Navigating", "Opening destination document"); }}
                          className="rounded p-1 hover:bg-gray-100" title="← Ir al destino"><ArrowLeft size={11} /></button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingLabel(link.id); setEditValue(link.etiqueta || ""); }} className="rounded p-1 hover:bg-gray-100" title="✏ Editar etiqueta"><Pencil size={11} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(link.id); }}
                          className={`rounded p-1 ${deleteConfirm === link.id ? "bg-red-100" : "hover:bg-red-50"}`}
                          title={deleteConfirm === link.id ? "⚠ Confirmar eliminación" : "🗑 Eliminar vínculo"} style={{ color: "#F44336" }}>
                          {deleteConfirm === link.id ? "?" : <Trash2 size={11} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Preview panel */}
        {selectedLink && (
          <div className="w-[300px] flex-shrink-0 border-l overflow-auto p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-1"><ExternalLink size={12} />Link preview</h3>
            <div className="rounded-md p-3 mb-2" style={{ backgroundColor: "rgba(241, 215, 255, 0.2)" }}>
              <p className="text-[10px] font-semibold opacity-50 mb-1">ORIGEN</p>
              <p className="text-xs leading-relaxed">{selectedLink.texto_origen || "Segment " + selectedLink.origen_id}</p>
              <p className="text-[9px] opacity-40 mt-1.5">📄 {selectedLink.texto_origen ? "doc origen" : selectedLink.origen_id.slice(0, 20)} › referencia</p>
            </div>
            <div className="flex justify-center py-1">
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "var(--peach)", color: "#1a1a1a" }}>
                → {selectedLink.etiqueta || "linked to"} →
              </span>
            </div>
            <div className="rounded-md p-3 mt-2" style={{ backgroundColor: "#E3F2FD" }}>
              <p className="text-[10px] font-semibold opacity-50 mb-1">DESTINO</p>
              <p className="text-xs leading-relaxed">{selectedLink.texto_destino || "Segment " + selectedLink.destino_id}</p>
              <p className="text-[9px] opacity-40 mt-1.5">📄 {selectedLink.texto_destino ? "doc destino" : selectedLink.destino_id.slice(0, 20)} › referencia</p>
            </div>
            <p className="mt-3 text-[10px] opacity-30">Creado: {selectedLink.fecha}</p>
            {selectedLink.investigador_id && <p className="text-[10px] opacity-30">Investigador: {selectedLink.investigador_id}</p>}
          </div>
        )}
      </div>

      {/* New link modal */}
      {showNewModal && <NewLinkModal projectId={project?.id || ""} onClose={() => setShowNewModal(false)} onCreated={() => { setShowNewModal(false); loadLinks(); }} />}
    </div>
  );
}

function NewLinkModal({ projectId, onClose, onCreated }: { projectId: string; onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1);
  const [origenId, setOrigenId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [label, setLabel] = useState("");
  const [citations, setCitations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (projectId) getCitations(projectId).then((r) => setCitations(r?.rows || [])).catch(() => {});
  }, [projectId]);

  const filtered = citations.filter((c) => !searchTerm ||
    (c.texto || "").toLowerCase().includes(searchTerm.toLowerCase()));

  const handleCreate = async () => {
    if (!origenId || !destinoId) return;
    const id = `link-${Date.now()}`;
    try {
      await saveLink(id, projectId, origenId, destinoId, label || null, null);
      toast.success("Link created", "Segment link saved");
      onCreated();
    } catch { toast.error("Error", "Could not create link"); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[560px] rounded-xl p-6 shadow-xl" style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">New link — Step {step}/3</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={14} /></button>
        </div>

        {step === 1 && (
          <div>
            <p className="text-xs mb-2 opacity-50">Search origin segment:</p>
            <input autoFocus value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search citations..." className="w-full rounded border px-3 py-2 text-xs mb-3 outline-none" style={{ borderColor: "var(--border)" }} />
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {filtered.slice(0, 20).map((c) => (
                <button key={c.id} onClick={() => { setOrigenId(c.id); setStep(2); setSearchTerm(""); }}
                  className={`w-full rounded px-2 py-1.5 text-left text-xs hover:bg-gray-100 ${c.id === origenId ? "" : ""}`}
                  style={{ backgroundColor: c.id === origenId ? "rgba(241, 215, 255, 0.3)" : "transparent" }}>
                  <span className="line-clamp-2">{(c.texto || c.texto_seleccionado || c.id).slice(0, 80)}</span>
                  <div className="mt-0.5 flex gap-2 text-[9px] opacity-40">
                    <span>📄 {(c.doc || c.doc_nombre || "doc").toString().slice(0, 25)}</span>
                    {c.pagina ? <span>Pág. {c.pagina}</span> : null}
                  </div>
                </button>
              ))}
            </div>
            {origenId && <p className="mt-2 text-[10px]" style={{ color: "#000" }}>✓ Origin selected</p>}
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-xs mb-2 opacity-50">Search destination segment:</p>
            <input autoFocus value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search citations..." className="w-full rounded border px-3 py-2 text-xs mb-3 outline-none" style={{ borderColor: "var(--border)" }} />
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {filtered.filter((c) => c.id !== origenId).slice(0, 20).map((c) => (
                <button key={c.id} onClick={() => { setDestinoId(c.id); setStep(3); }}
                  className={`w-full rounded px-2 py-1.5 text-left text-xs hover:bg-gray-100`}
                  style={{ backgroundColor: c.id === destinoId ? "rgba(241, 215, 255, 0.3)" : "transparent" }}>
                  <span className="line-clamp-2">{(c.texto || c.texto_seleccionado || c.id).slice(0, 80)}</span>
                  <div className="mt-0.5 flex gap-2 text-[9px] opacity-40">
                    <span>📄 {(c.doc || c.doc_nombre || "doc").toString().slice(0, 25)}</span>
                    {c.pagina ? <span>Pág. {c.pagina}</span> : null}
                  </div>
                </button>
              ))}
            </div>
            {destinoId && <p className="mt-2 text-[10px]" style={{ color: "#000" }}>✓ Destination selected</p>}
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="text-xs mb-2 opacity-50">Define the relationship label:</p>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. contradicts, expands, exemplifies..."
              className="w-full rounded border px-3 py-2 text-xs mb-3 outline-none" style={{ borderColor: "var(--border)" }} />
            <div className="rounded-md p-3 mb-3" style={{ backgroundColor: "var(--bg-secondary)" }}>
              <p className="text-[10px] opacity-50 mb-1">Preview:</p>
              <div className="space-y-2 text-xs">
                <div className="truncate px-2 py-1 rounded" style={{ backgroundColor: "rgba(241, 215, 255, 0.2)" }}>
                  {(citations.find((c) => c.id === origenId)?.texto || citations.find((c) => c.id === origenId)?.texto_seleccionado || origenId).slice(0, 60)}...
                </div>
                <div className="text-center font-bold" style={{ color: "#000" }}>→ {label || "linked to"} →</div>
                <div className="truncate px-2 py-1 rounded" style={{ backgroundColor: "#E3F2FD" }}>
                  {(citations.find((c) => c.id === destinoId)?.texto || citations.find((c) => c.id === destinoId)?.texto_seleccionado || destinoId).slice(0, 60)}...
                </div>
              </div>
            </div>
            <button onClick={handleCreate} disabled={!origenId || !destinoId}
              className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: "var(--peach)" }}>💾 Create link</button>
          </div>
        )}

        <div className="mt-4 flex justify-between">
          {step > 1 && <button onClick={() => setStep((s) => s - 1)} className="text-xs underline opacity-50">← Back</button>}
          {step < 3 && <div className="flex-1" />}
        </div>
      </div>
    </div>
  );
}

export default LinkAdmin;
