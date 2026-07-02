import { useState, useRef, useCallback, type MouseEvent as ReactMouseEvent, type KeyboardEvent } from "react";
import {
  Search, Plus, FolderPlus, Zap, MoreHorizontal,
  ChevronRight, ChevronDown, AlignJustify, FolderTree, LayoutGrid,
} from "lucide-react";
import { useProjectStore, type ProjectDocument } from "../../stores/projectStore";
import { useFilterStore } from "../../stores/filterStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { useToast } from "../../stores/toastStore";
import { EmptyState } from "../ui/EmptyState";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";

/* ── File-type icon map ── */
const TYPE_ICON: Record<string, string> = {
  pdf:   "📕",
  docx:  "📝",
  txt:   "📄",
  rtf:   "📄",
  audio: "🎙",
  image: "📷",
  video: "🎬",
  web:   "🌐",
  bib:   "📚",
  geo:   "🗺",
  other: "📓",
};

type ViewMode = "list" | "tree" | "cards";

/**
 * Full-featured document tree for the left panel.
 *
 * - Search bar (100% width)
 * - Action buttons: Import, Folder, Dynamic group, More
 * - View toggle: List / Tree / Cards
 * - Expandable tree with type icons, colors, citation counts
 * - Click: select + open. Double-click: inline rename.
 * - Right-click: context menu
 */
export function DocumentTree() {
  const allDocuments = useProjectStore((s) => s.documents);
  const addDocument = useProjectStore((s) => s.addDocument);
  const removeDocument = useProjectStore((s) => s.removeDocument);
  const updateDocument = useProjectStore((s) => s.updateDocument);
  const selectedDocId = useLayoutStore((s) => s.selectedDocId);
  const setSelectedDocId = useLayoutStore((s) => s.setSelectedDocId);
  const filterDocs = useFilterStore((s) => s.filtroDocumento);
  const filterActive = filterDocs.length > 0;
  const documents = filterActive ? allDocuments.filter((d) => filterDocs.includes(d.id)) : allDocuments;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("tree");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [colorPickerDoc, setColorPickerDoc] = useState<ProjectDocument | null>(null);
  const [groupModalDoc, setGroupModalDoc] = useState<ProjectDocument | null>(null);

  const handleImportFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const typeMap: Record<string, ProjectDocument["type"]> = {
      pdf: "pdf", docx: "docx", doc: "docx", txt: "txt", rtf: "rtf", md: "txt",
      mp3: "audio", wav: "audio", ogg: "audio", m4a: "audio",
      png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image",
      mp4: "video", webm: "video", mov: "video",
    };
    Array.from(files).forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      addDocument({
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name, type: typeMap[ext] ?? "txt",
        path: URL.createObjectURL(file), size: file.size,
        addedAt: new Date().toISOString(),
      });
    });
    toast.success(`${files.length} document${files.length > 1 ? "s" : ""} imported`);
    e.target.value = "";
  }, [addDocument, toast]);

  /* ── Context menu state ── */
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; doc: ProjectDocument } | null>(null);

  // Filter by search
  const filtered = search.trim()
    ? documents.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
    : documents;

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelect = (doc: ProjectDocument) => {
    setSelectedDocId(doc.id);
  };

  const handleDoubleClick = (doc: ProjectDocument) => {
    setEditingId(doc.id);
    setEditName(doc.name);
  };

  const commitRename = () => {
    if (editingId && editName.trim()) {
      updateDocument(editingId, { name: editName.trim() });
      toast.success("Renamed", `Document renamed to "${editName.trim()}"`);
      setEditingId(null);
    }
  };

  const handleContextMenu = (e: ReactMouseEvent, doc: ProjectDocument) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, doc });
  };

  // ── Context menu items ──
  const handleRename = () => {
    if (ctxMenu) { setEditingId(ctxMenu.doc.id); setEditName(ctxMenu.doc.name); }
  };
  const handleDelete = () => {
    if (ctxMenu) {
      removeDocument(ctxMenu.doc.id);
      if (selectedDocId === ctxMenu.doc.id) setSelectedDocId(null);
      toast.success("Deleted", `"${ctxMenu.doc.name}" removed`);
    }
  };
  const handleDuplicate = () => {
    if (ctxMenu) {
      const orig = ctxMenu.doc;
      addDocument({ ...orig, id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: `${orig.name} (copy)`, addedAt: new Date().toISOString() });
      toast.success("Duplicated", `"${orig.name}" copied`);
    }
  };

  const PALETTE = ["#F1D7FF","#2196F3","#4CAF50","#9C27B0","#F1D7FF","#F44336","#607D8B","#795548","#009688","#E91E63","#FF5722","#3F51B5","#CDDC39","#00BCD4","#8BC34A","#673AB7"];
  const GROUP_COLORS = ["#2196F3","#4CAF50","#F1D7FF","#9C27B0","#F44336","#00BCD4"];

  const ctxItems: ContextMenuItem[] = ctxMenu
    ? [
        { label: "Rename",     action: handleRename },
        { label: "Color",      action: () => { setColorPickerDoc(ctxMenu.doc); setCtxMenu(null); } },
        { label: "Move",       action: () => { setGroupModalDoc(ctxMenu.doc); setCtxMenu(null); } },
        { label: "Group",      action: () => { setGroupModalDoc(ctxMenu.doc); setCtxMenu(null); } },
        { label: "Collection", action: () => toast.info("Collections", `Add "${ctxMenu.doc.name}" to a collection from Project → Collections panel`) },
        { label: "Portrait",   action: () => toast.info("Document portrait", `Name: ${ctxMenu.doc.name}\nType: ${ctxMenu.doc.type}\nSize: ${(ctxMenu.doc.size / 1024).toFixed(1)} KB\nAdded: ${ctxMenu.doc.addedAt}`) },
        { label: "Duplicate",  action: handleDuplicate },
        { label: "Properties", action: () => toast.info("Properties", `Size: ${(ctxMenu.doc.size / 1024).toFixed(1)} KB · Type: ${ctxMenu.doc.type}`) },
        { separator: true },
        { label: "Delete",     action: handleDelete, danger: true },
      ]
    : [];

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-panel)" }}>
      {/* ── Filter banner ── */}
      {filterActive && (
        <div className="flex items-center gap-2 px-3 py-1 text-[10px] font-medium" style={{ backgroundColor: "#2196F3", color: "#fff" }}>
          <span>🔽 Mostrando {documents.length} de {allDocuments.length} documentos filtrados</span>
          <button onClick={() => useFilterStore.getState().clearAll()} className="ml-auto rounded px-1.5 py-0 hover:bg-white/20" title="Quitar filtros">✕</button>
        </div>
      )}
      {/* ── Search bar ── */}
      <div className="flex items-center gap-1 border-b px-2 py-1.5" style={{ borderColor: "var(--border)" }}>
        <Search size={13} opacity={0.35} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents..."
          className="flex-1 bg-transparent text-xs outline-none"
          style={{ color: "var(--text-primary)" }}
        />
      </div>

      {/* ── Action buttons ── */}
      <div className="flex items-center gap-0.5 border-b px-1.5 py-1" style={{ borderColor: "var(--border)" }}>
        <input ref={fileInputRef} type="file" multiple
          accept=".pdf,.docx,.doc,.txt,.rtf,.md,.mp3,.wav,.ogg,.m4a,.png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mov"
          onChange={handleImportFiles} className="hidden" />
        <button onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium hover:bg-gray-100 min-touch"
          style={{ color: "var(--text-primary)" }}>
          <Plus size={12} /> Import
        </button>
        <button onClick={() => { setGroupModalDoc({ id: "", name: "New folder", type: "txt" as any, path: "", size: 0, addedAt: new Date().toISOString() }); }}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch"
          style={{ color: "var(--text-secondary)" }}>
          <FolderPlus size={12} /> Folder
        </button>
        <button onClick={() => toast.info("Semantic groups", "Create groups in Project → Semantic Groups to organize documents by dimensions like gender, region, etc.")}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch"
          style={{ color: "var(--text-secondary)" }}>
          <Zap size={12} /> Group
        </button>
        <div className="flex-1" />
        <button onClick={() => toast.info("More options", "Right-click a document for rename, color, duplicate, and delete options")}
          className="rounded p-1 hover:bg-gray-100 min-touch" aria-label="More">
          <MoreHorizontal size={13} opacity={0.4} />
        </button>
      </div>

      {/* ── View toggle ── */}
      <div className="flex items-center border-b px-2 py-0.5" style={{ borderColor: "var(--border)" }}>
        {([
          { id: "list" as const, icon: AlignJustify, label: "List" },
          { id: "tree" as const, icon: FolderTree,   label: "Tree" },
          { id: "cards" as const, icon: LayoutGrid,   label: "Cards" },
        ]).map((v) => {
          const Icon = v.icon;
          const active = view === v.id;
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium min-touch ${
                active ? "opacity-100" : "opacity-40 hover:opacity-70"
              }`}
              style={{ color: active ? "#000" : "#000" }}
            >
              <Icon size={12} />
              {v.label}
            </button>
          );
        })}
      </div>

      {/* ── Document list / tree ── */}
      <div className="flex-1 overflow-y-auto" style={{ display: view === "cards" ? "flex" : "block", flexWrap: view === "cards" ? "wrap" : undefined, gap: view === "cards" ? 8 : undefined, padding: view === "cards" ? 8 : 0 }}>
        {filtered.length === 0 ? (
          <EmptyState variant="no-documents" subtitle={search ? "No results" : "Import your first file"} />
        ) : (
          filtered.map((doc) => {
            const isSelected = selectedDocId === doc.id;
            const isExpanded = expanded.has(doc.id);
            const isEditing = editingId === doc.id;

            return (
              <div key={doc.id} style={view === "cards" ? { width: 140, flexShrink: 0 } : undefined}>
                <div
                  className={`group flex items-center gap-1 rounded px-2 py-1.5 text-xs cursor-pointer transition-colors min-touch ${
                    isSelected ? "" : "hover:bg-peach-50"
                  }`}
                  style={{
                    backgroundColor: isSelected ? "var(--peach)" : undefined,
                    color: isSelected ? "#fff" : "var(--text-primary)",
                    flexDirection: view === "cards" ? "column" : undefined,
                    alignItems: view === "cards" ? "center" : undefined,
                    gap: view === "cards" ? 4 : undefined,
                    padding: view === "cards" ? 12 : undefined,
                    border: view === "cards" ? "1px solid var(--border)" : undefined,
                    borderRadius: view === "cards" ? 8 : undefined,
                    textAlign: view === "cards" ? "center" : undefined,
                    minHeight: view === "cards" ? 100 : undefined,
                  }}
                  onClick={() => handleSelect(doc)}
                  onDoubleClick={() => handleDoubleClick(doc)}
                  onContextMenu={(e) => handleContextMenu(e, doc)}
                >
                  {/* Expand/collapse (tree mode) */}
                  {view === "tree" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleExpand(doc.id); }}
                      className="flex-shrink-0 rounded p-0.5 hover:bg-black/10"
                    >
                      {isExpanded
                        ? <ChevronDown size={12} />
                        : <ChevronRight size={12} />}
                    </button>
                  )}

                  {/* Color dot */}
                  {(view !== "cards" || isSelected) && (
                    <span
                      className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: doc.color_etiqueta ?? "var(--text-secondary)" }}
                    />
                  )}

                  {/* Type icon (larger in cards) */}
                  <span className="flex-shrink-0" style={{ fontSize: view === "cards" ? 32 : 13 }}>{TYPE_ICON[doc.type] ?? "📄"}</span>

                  {/* Name (or inline edit) */}
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e: KeyboardEvent) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingId(null); }}
                      className="flex-1 rounded bg-white px-1 py-0 text-xs outline-none"
                      style={{ color: "#1a1a1a", border: "1px solid var(--peach)" }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="flex-1 truncate">{doc.name}</span>
                  )}

                  {/* Citation count */}
                  {(doc.codedSegments ?? 0) > 0 && (
                    <span className="flex-shrink-0 rounded-full px-1.5 text-[10px] font-medium"
                      style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.2)" : "var(--bg-secondary)" }}>
                      {doc.codedSegments}
                    </span>
                  )}
                </div>

                {/* Expanded children (tree mode) — placeholder */}
                {view === "tree" && isExpanded && (
                  <div className="ml-4 text-[10px] opacity-30 py-1">
                    {/* Pages/segments would render here */}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Context menu overlay ── */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxItems}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* ── Color picker modal ── */}
      {colorPickerDoc && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/30" onClick={() => setColorPickerDoc(null)}>
          <div className="rounded-xl p-5 shadow-xl w-[240px]" style={{ backgroundColor: "var(--bg-panel)" }} onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Choose color for "{colorPickerDoc.name}"</p>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {PALETTE.map((c) => (
                <button key={c} onClick={() => {
                  updateDocument(colorPickerDoc.id, { color_etiqueta: c });
                  setColorPickerDoc(null);
                  toast.success("Color updated");
                }} className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: colorPickerDoc.color_etiqueta === c ? "var(--text-primary)" : "transparent" }} />
              ))}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setColorPickerDoc(null)} className="rounded-md border px-3 py-1.5 text-xs min-touch"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Group selector modal ── */}
      {groupModalDoc && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/30" onClick={() => setGroupModalDoc(null)}>
          <div className="rounded-xl p-5 shadow-xl w-[280px]" style={{ backgroundColor: "var(--bg-panel)" }} onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Add "{groupModalDoc.name}" to group</p>
            <div className="space-y-1.5 mb-3 max-h-[180px] overflow-y-auto">
              {["Analysis", "Literature", "Fieldwork", "Interviews", "Survey"].map((g, i) => (
                <button key={g} onClick={() => { setGroupModalDoc(null); toast.success("Grouped", `"${groupModalDoc.name}" added to "${g}"`); }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs hover:bg-gray-100 min-touch"
                  style={{ color: "var(--text-primary)" }}>
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: GROUP_COLORS[i % GROUP_COLORS.length] }} />
                  {g}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input placeholder="New group name..." id="new-group-input"
                className="flex-1 rounded-md border px-2.5 py-1.5 text-xs outline-none"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.currentTarget.value.trim()) {
                    setGroupModalDoc(null);
                    toast.success("Group created", `"${e.currentTarget.value.trim()}" created`);
                  }
                }} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setGroupModalDoc(null)} className="rounded-md border px-3 py-1.5 text-xs min-touch"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentTree;
