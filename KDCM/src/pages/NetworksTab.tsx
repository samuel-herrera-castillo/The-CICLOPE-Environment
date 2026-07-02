import { useState, useEffect } from "react";
import { Plus, Search, Network, Trash2, GitFork, Pencil, Copy, Download, MessageSquare, GitCompare } from "lucide-react";
import { useProjectStore } from "../stores/projectStore";
import { useToast } from "../stores/toastStore";
import { EmptyState } from "../components/ui/EmptyState";
import { NetworkEditor, type SavedNet } from "../components/networks/NetworkEditor";
import { RelationTypeAdmin } from "../components/networks/RelationTypeAdmin";
import { saveNetwork as bridgeSaveNetwork, getNetworks as bridgeGetNetworks, deleteNetwork as bridgeDeleteNetwork } from "../lib/tauriBridge";

export function NetworksTabLeft() {
  const [networks, setNetworks] = useState<SavedNet[]>([]);
  const [search, setSearch] = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; net: SavedNet } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const { toast } = useToast();

  const filtered = networks.filter(n => n.name.toLowerCase().includes(search.toLowerCase()));

  const proyectoId = useProjectStore.getState().project?.id;

  const handleNew = () => {
    const net: SavedNet = { id: "net-" + Date.now(), name: "Network " + (networks.length + 1), nodes: [], edges: [], createdAt: new Date().toISOString() };
    setNetworks(p => [...p, net]);
    if (proyectoId) bridgeSaveNetwork(proyectoId, net.id, net.name, JSON.stringify({ nodes: [], edges: [], layout_actual: "unknown", zoom: 1, pan: { x: 0, y: 0 }, comunidades_json: {} }), null).catch(() => {});
    toast.success("Created", net.name);
  };

  const handleDelete = (id: string) => {
    setNetworks(p => p.filter(n => n.id !== id));
    setCtxMenu(null);
    bridgeDeleteNetwork(id).catch(() => {});
    toast.success("Deleted");
  };

  const handleDuplicate = (net: SavedNet) => {
    const dupId = "net-" + Date.now();
    const dup: SavedNet = { ...net, id: dupId, name: net.name + " (copy)", createdAt: new Date().toISOString() };
    setNetworks(p => [...p, dup]);
    setCtxMenu(null);
    if (proyectoId) bridgeSaveNetwork(proyectoId, dupId, dup.name, JSON.stringify({ nodes: net.nodes, edges: net.edges, layout_actual: net.layout || "unknown", zoom: net.zoom || 1, pan: net.pan || { x: 0, y: 0 }, comunidades_json: net.communities || {} }), net.thumbnail || null).catch(() => {});
    toast.success("Duplicated");
  };

  const handleExportJSON = (net: SavedNet) => {
    const d = JSON.stringify({ nodes: net.nodes, edges: net.edges, layout_actual: net.layout, zoom: net.zoom, pan: net.pan, comunidades_json: net.communities }, null, 2);
    navigator.clipboard?.writeText(d);
    toast.success("Copied", "Network JSON with layout and communities");
    setCtxMenu(null);
  };

  const handleCompare = () => {
    if (!compareA || !compareB) { toast.info("Select 2 networks", "Click compare then select two networks from the list"); return; }
    const netA = networks.find(n => n.id === compareA);
    const netB = networks.find(n => n.id === compareB);
    if (!netA || !netB) { toast.error("Error", "Network not found"); return; }
    const comparison = {
      networkA: { name: netA.name, nodes: netA.nodes.length, edges: netA.edges.length, created: netA.createdAt },
      networkB: { name: netB.name, nodes: netB.nodes.length, edges: netB.edges.length, created: netB.createdAt },
      diffNodes: netB.nodes.length - netA.nodes.length,
      diffEdges: netB.edges.length - netA.edges.length,
    };
    const d = JSON.stringify(comparison, null, 2);
    navigator.clipboard?.writeText(d);
    setCompareMode(false);
    setCompareA(null); setCompareB(null);
    toast.success("Compared", `"${netA.name}" vs "${netB.name}" — ${comparison.diffNodes >= 0 ? '+' : ''}${comparison.diffNodes} nodes, ${comparison.diffEdges >= 0 ? '+' : ''}${comparison.diffEdges} edges. Copied to clipboard.`);
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-panel)" }}>
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
          <Network size={13} /> Networks ({networks.length})
        </span>
        <button onClick={handleNew} className="rounded p-0.5 hover:bg-gray-100 min-touch" title="New network">
          <Plus size={14} opacity={0.5} />
        </button>
      </div>

      <div className="px-2 py-1">
        <div className="flex items-center gap-1 rounded border px-2 py-1" style={{ borderColor: "var(--border)" }}>
          <Search size={11} opacity={0.3} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search networks..."
            className="flex-1 bg-transparent text-[10px] outline-none" style={{ color: "var(--text-primary)" }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-[10px] opacity-20 text-center">No networks yet.<br />Click + to create one.</p>
        ) : (
          filtered.map(net => (
            <div key={net.id}
              className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50 min-touch group"
              style={{
                color: "var(--text-primary)",
                backgroundColor: (compareA === net.id || compareB === net.id) ? "var(--peach)" + "10" : "transparent",
              }}
              onDoubleClick={() => { /* open handled by parent via double-click event on center panel */ }}
              onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, net }); }}>
              {/* Thumbnail */}
              <div className="flex h-[32px] w-[52px] flex-shrink-0 items-center justify-center rounded border overflow-hidden"
                style={{ borderColor: "var(--border)" }}>
                {net.thumbnail
                  ? <div dangerouslySetInnerHTML={{ __html: net.thumbnail }} style={{ transform: "scale(0.15)", transformOrigin: "center" }} />
                  : <GitFork size={14} opacity={0.15} />}
              </div>
              <div className="flex-1 min-w-0">
                {editingId === net.id ? (
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    onBlur={() => { if (editName.trim()) { const newName = editName.trim(); setNetworks(p => p.map(n => n.id === net.id ? { ...n, name: newName } : n)); if (proyectoId) bridgeSaveNetwork(proyectoId, net.id, newName, JSON.stringify({ nodes: net.nodes, edges: net.edges, layout_actual: net.layout || "unknown", zoom: net.zoom || 1, pan: net.pan || { x: 0, y: 0 }, comunidades_json: net.communities || {} }), net.thumbnail || null).catch(() => {}); } setEditingId(null); }}
                    onKeyDown={e => { if (e.key === "Enter") { if (editName.trim()) { const newName = editName.trim(); setNetworks(p => p.map(n => n.id === net.id ? { ...n, name: newName } : n)); if (proyectoId) bridgeSaveNetwork(proyectoId, net.id, newName, JSON.stringify({ nodes: net.nodes, edges: net.edges, layout_actual: net.layout || "unknown", zoom: net.zoom || 1, pan: net.pan || { x: 0, y: 0 }, comunidades_json: net.communities || {} }), net.thumbnail || null).catch(() => {}); } setEditingId(null); } if (e.key === "Escape") setEditingId(null); }}
                    autoFocus className="w-full rounded border px-1 py-0.5 text-[10px] outline-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                ) : (
                  <div className="truncate font-medium">{net.name}</div>
                )}
                <div className="text-[9px] opacity-30">
                  {net.nodes.length}n · {net.edges.length}e · {new Date(net.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingId(net.id); setEditName(net.name); }}
                  className="rounded p-0.5 hover:bg-gray-200" title="Rename"><Pencil size={9} /></button>
                <button onClick={() => handleDelete(net.id)}
                  className="rounded p-0.5 hover:bg-red-50" title="Delete"><Trash2 size={9} className="text-red-400" /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Compare button */}
      <div className="border-t px-2 py-1.5" style={{ borderColor: "var(--border)" }}>
        <button onClick={() => setCompareMode(!compareMode)}
          className={"flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-[10px] font-medium min-touch " + (compareMode ? "bg-peach-50" : "hover:bg-gray-50")}
          style={{ color: compareMode ? "#000" : "#000" }}>
          <GitCompare size={11} /> Compare networks
        </button>
        {compareMode && (
          <div className="mt-1 space-y-1">
            <select value={compareA || ""} onChange={e => setCompareA(e.target.value || null)}
              className="w-full rounded border px-2 py-1 text-[10px] outline-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
              <option value="">Network A...</option>
              {networks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
            <select value={compareB || ""} onChange={e => setCompareB(e.target.value || null)}
              className="w-full rounded border px-2 py-1 text-[10px] outline-none" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
              <option value="">Network B...</option>
              {networks.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
            <button onClick={handleCompare} disabled={!compareA || !compareB}
              className="w-full rounded bg-peach-500 px-2 py-1 text-[10px] font-medium text-white hover:bg-peach-700 disabled:opacity-30 min-touch">
              Compare
            </button>
          </div>
        )}
      </div>

      {/* Relation types */}
      <div className="border-t" style={{ borderColor: "var(--border)" }}>
        <button onClick={() => setShowAdmin(true)}
          className="flex w-full items-center gap-1.5 px-3 py-2 text-[10px] font-medium hover:bg-gray-50 min-touch"
          style={{ color: "var(--text-secondary)" }}>⚙ Relation types</button>
        {showAdmin && <RelationTypeAdmin onClose={() => setShowAdmin(false)} />}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-[400]" onClick={() => setCtxMenu(null)} />
          <div className="fixed z-[410] min-w-[160px] rounded-lg border py-1 shadow-xl"
            style={{ left: Math.min(ctxMenu.x, window.innerWidth - 170), top: Math.min(ctxMenu.y, window.innerHeight - 240), borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
            <button onClick={() => { setEditingId(ctxMenu.net.id); setEditName(ctxMenu.net.name); setCtxMenu(null); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-primary)" }}><Pencil size={11} /> Rename</button>
            <button onClick={() => { toast.info("Comment", "Add notes to network"); setCtxMenu(null); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-primary)" }}><MessageSquare size={11} /> Comment</button>
            <button onClick={() => handleDuplicate(ctxMenu.net)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-primary)" }}><Copy size={11} /> Duplicate</button>
            <button onClick={() => handleExportJSON(ctxMenu.net)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-primary)" }}><Download size={11} /> Export JSON</button>
            <div className="border-t my-0.5" style={{ borderColor: "var(--border)" }} />
            <button onClick={() => handleDelete(ctxMenu.net.id)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[10px] hover:bg-red-50 min-touch" style={{ color: "#F44336" }}><Trash2 size={11} /> Delete</button>
          </div>
        </>
      )}
    </div>
  );
}

export function NetworksTabCenter() {
  const categories = useProjectStore(s => s.categories);
  const documents = useProjectStore(s => s.documents);
  const memos = useProjectStore(s => s.memos);
  const [networks, setNetworks] = useState<SavedNet[]>([]);
  const [activeNetId, setActiveNetId] = useState<string | null>(null);
  const activeNet = networks.find(n => n.id === activeNetId) ?? null;

  const handleSave = (net: SavedNet) => {
    setNetworks(p => { const i = p.findIndex(n => n.id === net.id); if (i >= 0) { const c = [...p]; c[i] = net; return c; } return [...p, net]; });
    // Persist to SQLite backend
    const proyectoId = useProjectStore.getState().project?.id;
    if (proyectoId) {
      bridgeSaveNetwork(proyectoId, net.id, net.name, JSON.stringify({ nodes: net.nodes, edges: net.edges, layout_actual: net.layout || "unknown", zoom: net.zoom || 1, pan: net.pan || { x: 0, y: 0 }, comunidades_json: net.communities || {} }), net.thumbnail || null).catch(() => {});
    }
  };

  // Load networks from backend on mount
  useEffect(() => {
    const proyectoId = useProjectStore.getState().project?.id;
    if (proyectoId) {
      bridgeGetNetworks(proyectoId).then((nets) => {
        if (nets && nets.length > 0) {
          setNetworks(nets.map((n: any) => {
            const data = JSON.parse(n.datos_json || "{}");
            return {
              id: n.id,
              name: n.nombre || n.name,
              nodes: data.nodes || [],
              edges: data.edges || [],
              createdAt: n.fecha || n.createdAt || new Date().toISOString(),
              thumbnail: n.miniatura_svg || n.thumbnail,
              layout: data.layout_actual,
              zoom: data.zoom,
              pan: data.pan,
              communities: data.comunidades_json,
            };
          }));
        }
      }).catch(() => {});
    }
  }, []);

  if (activeNetId && activeNet) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-hidden">
          <NetworkEditor categories={categories} documents={documents} memos={memos}
            onSave={handleSave} initialNetwork={activeNet} onBack={() => setActiveNetId(null)} allNetworks={networks} />
        </div>
      </div>
    );
  }

  if (activeNetId === "new") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-hidden">
          <NetworkEditor categories={categories} documents={documents} memos={memos}
            onSave={handleSave} initialNetwork={null} onBack={() => setActiveNetId(null)} allNetworks={networks} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="text-center max-w-lg">
        <Network size={48} opacity={0.1} className="mx-auto mb-3" />
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Networks</p>
        <p className="mt-1 text-xs opacity-30">
          Visualize relationships between categories, documents, and memos.<br />
          Create nodes, connect them with edges, analyze network structure.
        </p>
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setActiveNetId("new")}
            className="inline-flex items-center gap-1.5 rounded-md bg-peach-500 px-4 py-2 text-sm font-medium text-white hover:bg-peach-700 min-touch">
            <Plus size={15} /> New network
          </button>
        </div>
        {networks.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xs font-semibold mb-3 opacity-30">Saved networks ({networks.length})</h3>
            <div className="grid grid-cols-3 gap-3">
              {networks.map(net => (
                <button key={net.id} onClick={() => setActiveNetId(net.id)}
                  className="flex flex-col items-center gap-2 rounded-lg border p-4 text-left hover:shadow-md transition-all min-touch"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
                  <div className="flex h-[60px] w-[100px] items-center justify-center rounded-md overflow-hidden"
                    style={{ backgroundColor: "var(--bg-secondary)" }}>
                    {net.thumbnail
                      ? <div dangerouslySetInnerHTML={{ __html: net.thumbnail }} style={{ transform: "scale(0.35)", transformOrigin: "center" }} />
                      : <GitFork size={28} opacity={0.2} />}
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-medium" style={{ color: "var(--text-primary)" }}>{net.name}</p>
                    <p className="text-[9px] opacity-30">
                      {net.nodes.length}n · {net.edges.length}e · {new Date(net.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function NetworksTabRight() {
  return <EmptyState variant="no-selection" subtitle="Select a node or edge to inspect" />;
}
