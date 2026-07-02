import { useState } from "react";
import { Plus, Download, Trash2, ExternalLink, FolderOpen } from "lucide-react";
import { useToast } from "../../stores/toastStore";

interface Collection {
  id: string; name: string; description: string; items: CollectionItem[]; createdAt: string;
}

interface CollectionItem {
  id: string; type: "document" | "category" | "segment" | "memo";
  label: string; color?: string; parent?: string;
}

const TYPE_ICONS: Record<string, string> = { document: "📄", category: "🏷", segment: "📌", memo: "📝" };

function generateCollections(): Collection[] {
  // No precargados — datos reales desde SQLite vía colecciones + coleccion_items
  return [];
}

export function CollectionsPanel() {
  const [collections, setCollections] = useState<Collection[]>(generateCollections());
  const [selectedCol, setSelectedCol] = useState<Collection | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const { toast } = useToast();

  const createCollection = () => {
    if (!newName.trim()) return;
    const col: Collection = {
      id: `col-${Date.now()}`, name: newName.trim(), description: "",
      items: [], createdAt: "just now",
    };
    setCollections((prev) => [col, ...prev]);
    setSelectedCol(col);
    setCreating(false); setNewName("");
    toast.success("Created", `Collection "${col.name}"`);
  };

  return (
    <div className="flex h-full" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Left — Collections list */}
      <div className="w-[240px] flex-shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <div className="border-b px-3 py-2.5 flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
          <FolderOpen size={13} opacity={0.4} />
          <span className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>Collections</span>
          <button onClick={() => setCreating(true)}
            className="ml-auto rounded p-0.5 hover:bg-gray-100"><Plus size={13} opacity={0.4} /></button>
        </div>

        {creating && (
          <div className="border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createCollection(); if (e.key === "Escape") setCreating(false); }}
              placeholder="Collection name..." autoFocus
              className="w-full rounded border px-2 py-1.5 text-[11px] outline-none mb-2"
              style={{ borderColor: "var(--peach)", color: "var(--text-primary)" }} />
            <div className="flex gap-1">
              <button onClick={createCollection}
                className="rounded bg-peach-500 px-2 py-1 text-[10px] font-medium text-white min-touch">Create</button>
              <button onClick={() => setCreating(false)}
                className="rounded px-2 py-1 text-[10px] min-touch" style={{ color: "var(--text-secondary)" }}>Cancel</button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {collections.map((col) => (
            <button key={col.id} onClick={() => setSelectedCol(col)}
              className={`w-full text-left px-3 py-2 border-b text-xs min-touch ${
                selectedCol?.id === col.id ? "" : "hover:bg-gray-50"
              }`}
              style={{
                borderColor: "var(--border)",
                backgroundColor: selectedCol?.id === col.id ? "var(--peach)" + "08" : "transparent",
                borderLeft: selectedCol?.id === col.id ? "2px solid var(--peach)" : "2px solid transparent",
              }}>
              <p className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{col.name}</p>
              <p className="text-[9px] opacity-30">{col.items.length} items · {col.createdAt}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right — Collection detail */}
      <div className="flex-1 flex flex-col">
        {selectedCol ? (
          <>
            <div className="flex items-center gap-3 border-b px-4 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{selectedCol.name}</h3>
              <span className="text-[9px] opacity-20">{selectedCol.items.length} items</span>
              <div className="flex-1" />
              <button onClick={() => {
                setCollections((prev) => prev.filter((c) => c.id !== selectedCol.id));
                setSelectedCol(collections.find((c) => c.id !== selectedCol.id) ?? null);
                toast.success("Deleted", "Collection removed");
              }}
                className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-red-400 hover:bg-red-50 min-touch">
                <Trash2 size={10} /> Delete
              </button>
              <button onClick={() => toast.info("Export", "Export collection...")}
                className="flex items-center gap-1 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch"
                style={{ color: "var(--text-secondary)" }}>
                <Download size={10} /> Export
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {selectedCol.items.map((item) => (
                <div key={item.id} className="flex items-center gap-2.5 rounded-md border p-2.5 text-xs cursor-pointer hover:bg-gray-50 min-touch"
                  style={{ borderColor: "var(--border)" }}>
                  <span className="text-base">{TYPE_ICONS[item.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.label}</p>
                    {item.parent && <p className="text-[9px] opacity-30">{item.parent}</p>}
                  </div>
                  <button onClick={() => toast.info("Navigate", `Opening ${item.label}...`)}
                    className="rounded p-1 hover:bg-gray-100 opacity-20 hover:opacity-60">
                    <ExternalLink size={11} />
                  </button>
                </div>
              ))}
              {selectedCol.items.length === 0 && (
                <p className="py-8 text-center text-xs opacity-20">
                  Right-click any document, category, segment, or memo → "Add to collection"
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs opacity-20">
            Select a collection or create a new one
          </div>
        )}
      </div>
    </div>
  );
}

export default CollectionsPanel;
