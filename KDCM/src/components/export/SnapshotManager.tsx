import { useState } from "react";
import { X, Download, Camera, RotateCcw, Trash2, Archive, GitCompare } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { saveSnapshot, getSnapshots, restoreSnapshot, deleteSnapshot, exportProjectState } from "../../lib/tauriBridge";

interface Props { open: boolean; onClose: () => void; }
interface Snapshot { id: string; nombre: string; descripcion: string | null; datos_json: string; fecha: string; }

interface DiffResult {
  added: { entidad: string; nombre: string; detalles: string }[];
  removed: { entidad: string; nombre: string; detalles: string }[];
  modified: { entidad: string; nombre: string; detalles: string }[];
}

export function SnapshotManager({ open, onClose }: Props) {
  const project = useProjectStore((s) => s.project);
  const { toast } = useToast();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showRestore, setShowRestore] = useState<string | null>(null);
  const [showCompare, setShowCompare] = useState<{a: Snapshot; b: Snapshot} | null>(null);
  const [compareSelectB, setCompareSelectB] = useState<string>("");
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const loadSnapshots = async () => {
    if (!project?.id) return;
    try { const snaps = await getSnapshots(project.id); setSnapshots(snaps as Snapshot[]); } catch { setSnapshots([]); }
    setLoaded(true);
  };

  if (open && !loaded) { loadSnapshots(); }

  const handleClose = () => { setLoaded(false); setSnapshots([]); setShowCreate(false); setShowRestore(null); setShowCompare(null); setDiffResult(null); onClose(); };

  const handleCreate = async () => {
    if (!project?.id) return;
    setSaving(true);
    try {
      const stateJson = await exportProjectState(project.id);
      const id = `snap-${Date.now()}`;
      const name = newName || `Snapshot ${snapshots.length+1} — ${new Date().toLocaleString()}`;
      await saveSnapshot(id, project.id, name, newDesc || null, stateJson);
      toast.success("📸 Snapshot saved", name);
      setShowCreate(false); setNewName(""); setNewDesc(""); setLoaded(false);
    } catch(e:any) { toast.error("Error", e.message); }
    finally { setSaving(false); }
  };

  const handleRestore = async (snapId: string) => {
    if (!project?.id) return;
    try {
      const currentJson = await exportProjectState(project.id);
      await saveSnapshot(`snap-auto-${Date.now()}`, project.id, "Auto-save before restore", null, currentJson);
      await restoreSnapshot(snapId, project.id);
      toast.success("✅ Project restored", "Reloading...");
      setShowRestore(null);
      setTimeout(() => window.location.reload(), 1500);
    } catch(e:any) { toast.error("Error", e.message); }
  };

  const handleDelete = async (snapId: string) => {
    if (!confirm("Delete this snapshot? This action cannot be undone.")) return;
    try { await deleteSnapshot(snapId); setSnapshots(prev => prev.filter(s => s.id!==snapId)); toast.success("Deleted"); }
    catch(e:any) { toast.error("Error", e.message); }
  };

  const handleExport = (snap: Snapshot) => {
    const blob = new Blob([snap.datos_json], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`${(project?.name||"kdcm").replace(/\s+/g,"_")}_${snap.fecha.slice(0,10)}.kdcm`;
    a.click(); URL.revokeObjectURL(url);
  };

  const formatSize = (json: string) => {
    const kb = new Blob([json]).size/1024;
    return kb>1024 ? `${(kb/1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
  };

  // ── Comparison ──
  const startCompare = (snapA: Snapshot) => {
    setShowCompare({a: snapA, b: null as any});
    setCompareSelectB("");
    setDiffResult(null);
  };

  const runCompare = () => {
    if (!showCompare || !compareSelectB) return;
    const snapB = snapshots.find(s => s.id === compareSelectB);
    if (!snapB) return;

    try {
      const dataA = JSON.parse(showCompare.a.datos_json);
      const dataB = JSON.parse(snapB.datos_json);

      const added: DiffResult["added"] = [];
      const removed: DiffResult["removed"] = [];
      const modified: DiffResult["modified"] = [];

      const compareArrays = (keyA: any[], keyB: any[], entidad: string, idField: string, nameField: string) => {
        const idsA = new Set(keyA.map((x:any) => x[idField]));
        const idsB = new Set(keyB.map((x:any) => x[idField]));

        for (const item of keyB) {
          if (!idsA.has(item[idField])) added.push({ entidad, nombre: item[nameField]||item[idField], detalles: `Added in B` });
        }
        for (const item of keyA) {
          if (!idsB.has(item[idField])) removed.push({ entidad, nombre: item[nameField]||item[idField], detalles: `Removed in B` });
          else {
            const aItem = JSON.stringify(keyA.find((x:any)=>x[idField]===item[idField]));
            const bItem = JSON.stringify(item);
            if (aItem !== bItem) modified.push({ entidad, nombre: item[nameField]||item[idField], detalles: `Modified` });
          }
        }
      };

      const docA = dataA.documentos || []; const docB = dataB.documentos || [];
      const catA = dataA.codigos || []; const catB = dataB.codigos || [];
      const memoA = dataA.memos || []; const memoB = dataB.memos || [];

      compareArrays(docA, docB, "Document", "id", "nombre");
      compareArrays(catA, catB, "Category", "id", "nombre");
      compareArrays(memoA, memoB, "Memo", "id", "titulo");

      setDiffResult({ added, removed, modified });
      setShowCompare({...showCompare, b: snapB});
    } catch(e:any) { toast.error("Comparison error", e.message); }
  };

  const exportComparison = () => {
    if (!diffResult) return;
    const rows = [
      ["Type","Entity","Name","Details"],
      ...diffResult.added.map(d => ["✅ ADDED", d.entidad, d.nombre, d.detalles]),
      ...diffResult.removed.map(d => ["❌ REMOVED", d.entidad, d.nombre, d.detalles]),
      ...diffResult.modified.map(d => ["✏ MODIFIED", d.entidad, d.nombre, d.detalles]),
    ];
    const csv = rows.map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="snapshot_comparison.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.5)"}}>
      <div className="w-full max-w-[900px] rounded-xl shadow-2xl flex flex-col" style={{maxHeight:"85vh",backgroundColor:"var(--bg-primary)",color:"var(--text-primary)"}} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-3" style={{borderColor:"var(--border)"}}>
          <div className="flex items-center gap-2"><Camera size={18} style={{color:"#9b59b6"}}/><h2 className="text-base font-bold">📸 Project Snapshots</h2></div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white" style={{backgroundColor:"#9b59b6"}}><Camera size={12}/> New Snapshot</button>
            <button onClick={handleClose} className="rounded p-1 hover:bg-gray-100"><X size={16}/></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {snapshots.length===0 ? (
            <div className="flex flex-col items-center justify-center py-16 opacity-40"><Archive size={48}/><p className="mt-3 text-sm">No snapshots yet</p><p className="text-xs">Create a snapshot to save the current project state. Ctrl+S for quick save.</p></div>
          ) : showCompare ? (
            /* ── Compare view ── */
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button onClick={()=>{setShowCompare(null);setDiffResult(null);}} className="text-xs opacity-50 hover:opacity-80">← Back to list</button>
                <span className="text-xs opacity-30">Comparing:</span>
                <span className="text-xs font-medium">{showCompare.a.nombre}</span>
                <span className="text-xs opacity-30">vs</span>
                {showCompare.b ? (
                  <span className="text-xs font-medium">{showCompare.b.nombre}</span>
                ) : (
                  <select value={compareSelectB} onChange={e=>setCompareSelectB(e.target.value)}
                    className="rounded border px-2 py-1 text-xs" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}>
                    <option value="">— Select snapshot B —</option>
                    {snapshots.filter(s=>s.id!==showCompare.a.id).map(s=><option key={s.id} value={s.id}>{s.nombre} ({s.fecha})</option>)}
                  </select>
                )}
                {!showCompare.b && <button onClick={runCompare} disabled={!compareSelectB} className="rounded-md px-3 py-1 text-xs font-medium text-white disabled:opacity-30" style={{backgroundColor:"#9b59b6"}}>Compare</button>}
              </div>

              {diffResult && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button onClick={exportComparison} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px]" style={{borderColor:"var(--border)"}}><Download size={10}/> Export to Excel</button>
                    <span className="text-[10px] opacity-40">{diffResult.added.length+diffResult.removed.length+diffResult.modified.length} differences</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {/* Added */}
                    <div>
                      <div className="rounded-t-lg px-3 py-2 text-xs font-bold text-white" style={{backgroundColor:"#43A047"}}>✅ ADDED ({diffResult.added.length})</div>
                      <div className="rounded-b-lg border-x border-b p-2 space-y-1 max-h-[300px] overflow-y-auto" style={{borderColor:"var(--border)"}}>
                        {diffResult.added.length===0 ? <p className="text-[10px] opacity-30">None</p> :
                          diffResult.added.map((d,i)=><div key={i} className="text-[10px]"><b>{d.entidad}</b>: {d.nombre}</div>)}
                      </div>
                    </div>
                    {/* Removed */}
                    <div>
                      <div className="rounded-t-lg px-3 py-2 text-xs font-bold text-white" style={{backgroundColor:"#E53935"}}>❌ REMOVED ({diffResult.removed.length})</div>
                      <div className="rounded-b-lg border-x border-b p-2 space-y-1 max-h-[300px] overflow-y-auto" style={{borderColor:"var(--border)"}}>
                        {diffResult.removed.length===0 ? <p className="text-[10px] opacity-30">None</p> :
                          diffResult.removed.map((d,i)=><div key={i} className="text-[10px]"><b>{d.entidad}</b>: {d.nombre}</div>)}
                      </div>
                    </div>
                    {/* Modified */}
                    <div>
                      <div className="rounded-t-lg px-3 py-2 text-xs font-bold text-white" style={{backgroundColor:"#F4A261"}}>✏ MODIFIED ({diffResult.modified.length})</div>
                      <div className="rounded-b-lg border-x border-b p-2 space-y-1 max-h-[300px] overflow-y-auto" style={{borderColor:"var(--border)"}}>
                        {diffResult.modified.length===0 ? <p className="text-[10px] opacity-30">None</p> :
                          diffResult.modified.map((d,i)=><div key={i} className="text-[10px]"><b>{d.entidad}</b>: {d.nombre}<br/><span className="opacity-50">{d.detalles}</span></div>)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Grid of snapshots ── */
            <div className="grid grid-cols-3 gap-3">
              {snapshots.map(snap => (
                <div key={snap.id} className="rounded-lg border p-3 space-y-2 hover:shadow-md transition-shadow" style={{borderColor:"var(--border)"}}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{snap.nombre}</p>
                      <p className="text-[10px] opacity-40">{snap.fecha} · {formatSize(snap.datos_json)}</p>
                    </div>
                    <span className="text-lg flex-shrink-0">📸</span>
                  </div>
                  {snap.descripcion && <p className="text-xs opacity-50 line-clamp-2">{snap.descripcion}</p>}
                  <div className="flex gap-1 pt-1 border-t" style={{borderColor:"var(--border)"}}>
                    <button onClick={()=>setShowRestore(snap.id)} className="rounded px-2 py-1 text-[10px] hover:bg-red-50 hover:text-red-600 flex items-center gap-0.5" title="Restore"><RotateCcw size={11}/> Restore</button>
                    <button onClick={()=>startCompare(snap)} className="rounded px-2 py-1 text-[10px] hover:bg-blue-50 hover:text-blue-600 flex items-center gap-0.5" title="Compare"><GitCompare size={11}/> Compare</button>
                    <button onClick={()=>handleExport(snap)} className="rounded px-2 py-1 text-[10px] hover:bg-gray-100" title="Export .kdcm"><Download size={11}/></button>
                    <button onClick={()=>handleDelete(snap.id)} className="rounded px-2 py-1 text-[10px] hover:bg-red-50 hover:text-red-600 ml-auto" title="Delete"><Trash2 size={11}/></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end border-t px-5 py-2" style={{borderColor:"var(--border)"}}>
          <button onClick={handleClose} className="rounded border px-4 py-1.5 text-xs" style={{borderColor:"var(--border)"}}>Close</button>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.6)"}} onClick={()=>setShowCreate(false)}>
            <div className="w-[380px] rounded-xl p-5 space-y-4" style={{backgroundColor:"var(--bg-primary)"}} onClick={e=>e.stopPropagation()}>
              <h3 className="text-sm font-bold">📸 Create Snapshot</h3>
              <p className="text-[10px] opacity-40">Saves the complete project state (documents, categories, citations, memos, networks) to SQLite.</p>
              <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Snapshot name" className="w-full rounded border px-3 py-2 text-sm" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}/>
              <textarea value={newDesc} onChange={e=>setNewDesc(e.target.value)} placeholder="Description (optional) — e.g. 'Before merging categories'" rows={2} className="w-full rounded border px-3 py-2 text-sm" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-primary)"}}/>
              <div className="flex justify-end gap-2">
                <button onClick={()=>setShowCreate(false)} className="rounded border px-4 py-1.5 text-xs" style={{borderColor:"var(--border)"}}>Cancel</button>
                <button onClick={handleCreate} disabled={saving} className="rounded-md px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40" style={{backgroundColor:"#9b59b6"}}>{saving?"Compressing...":"📸 Create Snapshot"}</button>
              </div>
            </div>
          </div>
        )}

        {/* Restore confirm */}
        {showRestore && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.6)"}} onClick={()=>setShowRestore(null)}>
            <div className="w-[420px] rounded-xl p-5 space-y-4" style={{backgroundColor:"#FFF0F0"}} onClick={e=>e.stopPropagation()}>
              <h3 className="text-sm font-bold text-red-700">⚠ Restore Snapshot?</h3>
              <p className="text-xs text-red-600">This will <b>replace</b> the current project state with the snapshot data. Changes made after the snapshot date will be <b>lost</b>.</p>
              <p className="text-[10px] opacity-50">An auto-save of the current state will be created before restoring.</p>
              <div className="flex justify-end gap-2">
                <button onClick={()=>setShowRestore(null)} className="rounded border px-4 py-1.5 text-xs">Cancel</button>
                <button onClick={()=>handleRestore(showRestore)} className="rounded-md bg-red-600 px-4 py-1.5 text-xs font-medium text-white">↩ Yes, restore</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default SnapshotManager;
