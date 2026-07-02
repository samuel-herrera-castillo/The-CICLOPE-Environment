import { useState } from "react";
import {
  Search, X, ChevronRight, ChevronDown, FileText, Tag, StickyNote,
  Network, FolderOpen, Maximize2, Minimize2,
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";

export function ProjectNavigator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const documents = useProjectStore((s) => s.documents);
  const categories = useProjectStore((s) => s.categories);
  const memos = useProjectStore((s) => s.memos);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["docs","cats","memos"]));
  const { toast } = useToast();

  if (!open) return null;

  const toggle = (key: string) => {
    setExpanded((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  const allItems = [
    ...documents.map((d) => ({ id: d.id, label: d.name, type: "doc" as const, data: d })),
    ...categories.map((c) => ({ id: c.id, label: c.name, type: "category" as const, color: c.color, data: c })),
    ...memos.map((m) => ({ id: m.id, label: m.title, type: "memo" as const, data: m })),
  ];

  const filtered = search.trim()
    ? allItems.filter((item) => item.label.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <div className="fixed left-0 top-0 z-[320] flex h-full w-[280px] flex-col shadow-2xl animate-slide-in"
      style={{ backgroundColor: "var(--bg-panel)", borderRight: "1px solid var(--border)" }}>

      {/* Header */}
      <div className="flex items-center gap-1 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <FolderOpen size={14} opacity={0.4} />
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Project navigator</span>
        <span className="text-[9px] opacity-20 ml-1">Ctrl+E</span>
        <div className="flex-1" />
        <button onClick={() => { setExpanded(new Set(["docs","cats","memos","networks","collections"])); }}
          className="rounded p-1 hover:bg-gray-100" title="Expand all"><Maximize2 size={12} opacity={0.3} /></button>
        <button onClick={() => setExpanded(new Set())}
          className="rounded p-1 hover:bg-gray-100" title="Collapse all"><Minimize2 size={12} opacity={0.3} /></button>
        <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={14} /></button>
      </div>

      {/* Search */}
      <div className="border-b px-3 py-1.5" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1.5">
          <Search size={12} opacity={0.25} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Type to filter..."
            className="flex-1 bg-transparent text-[11px] outline-none" style={{ color: "var(--text-primary)" }} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-1">
        {search.trim() ? (
          /* Search results */
          <div>
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-[10px] opacity-20 text-center">No results</p>
            ) : (
              filtered.map((item) => (
                <button key={item.id} onClick={() => { toast.info("Navigate", `Opening ${item.label}...`); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-gray-50 min-touch"
                  style={{ color: "var(--text-primary)" }}>
                  {item.type === "doc" ? <FileText size={11} opacity={0.3} />
                    : item.type === "category" ? <Tag size={11} style={{ color: item.color }} />
                    : <StickyNote size={11} opacity={0.3} />}
                  <span className="truncate flex-1 text-left">{item.label}</span>
                  <span className="text-[8px] opacity-20 capitalize">{item.type}</span>
                </button>
              ))
            )}
          </div>
        ) : (
          /* Tree view */
          <div>
            {[
              { key: "docs", label: "Documents", icon: FileText, items: documents, type: "doc" },
              { key: "cats", label: "Categories", icon: Tag, items: categories, type: "category" },
              { key: "memos", label: "Memos", icon: StickyNote, items: memos, type: "memo" },
              { key: "networks", label: "Networks", icon: Network, items: [], type: "network" },
              { key: "collections", label: "Collections", icon: FolderOpen, items: [], type: "collection" },
            ].map((section) => {
              const Icon = section.icon;
              const isExp = expanded.has(section.key);
              return (
                <div key={section.key}>
                  <button onClick={() => toggle(section.key)}
                    className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold hover:bg-gray-50 min-touch"
                    style={{ color: "var(--text-primary)" }}>
                    {isExp ? <ChevronDown size={10} opacity={0.4} /> : <ChevronRight size={10} opacity={0.4} />}
                    <Icon size={12} opacity={0.4} />
                    {section.label}
                    <span className="text-[9px] opacity-20 ml-auto">{(section.items as any[]).length}</span>
                  </button>
                  {isExp && section.items.length > 0 && (section.items as any[]).map((item: any) => (
                    <button key={item.id}
                      onDoubleClick={() => toast.info("Open", `Opening ${item.name ?? item.title ?? item.id}...`)}
                      onClick={() => toast.info("Select", `Selected ${item.name ?? item.title}`)}
                      className="flex w-full items-center gap-2 pl-8 pr-3 py-1 text-[11px] hover:bg-gray-50 min-touch"
                      style={{ color: "var(--text-primary)" }}>
                      {section.key === "cats" && <span className="inline-block h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />}
                      <span className="truncate text-left flex-1">{item.name ?? item.title ?? item.id}</span>
                      {section.key === "cats" && item.count > 0 && (
                        <span className="text-[9px] opacity-20">({item.count})</span>
                      )}
                    </button>
                  ))}
                  {isExp && section.items.length === 0 && (
                    <p className="pl-8 pr-3 py-1 text-[10px] opacity-15">None yet</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 border-t px-3 py-1.5 text-[9px] opacity-20" style={{ borderColor: "var(--border)" }}>
        <span>Click: select</span><span>Dbl-click: open</span><span>Ctrl+E: toggle</span>
      </div>
    </div>
  );
}

export default ProjectNavigator;
