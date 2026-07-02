import { useState, useCallback, useEffect } from "react";
import {
  Search, Plus, Zap, ChevronRight, ChevronDown, MoreHorizontal,
  TreePine, AlignJustify, LayoutGrid, Cloud, Sparkles, GripVertical,
  Download, Upload, EyeOff,
} from "lucide-react";
import { useProjectStore, type Category } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { useFilterStore } from "../../stores/filterStore";
import { CategoryModal } from "./CategoryModal";
import { CategoryInspector } from "./CategoryInspector";
import { EmptyState } from "../ui/EmptyState";

type ViewMode = "tree" | "list" | "treemap" | "cloud";
type FilterMode = "all" | "with-segments" | "without-segments" | "smart" | "in-vivo";

const FILTERS: { id: FilterMode; label: string }[] = [
  { id: "all", label: "All" },
  { id: "with-segments", label: "With segments" },
  { id: "without-segments", label: "No segments" },
  { id: "smart", label: "Smart" },
  { id: "in-vivo", label: "In vivo" },
];

const VIEWS: { id: ViewMode; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "tree", label: "Tree", icon: TreePine },
  { id: "list", label: "List", icon: AlignJustify },
  { id: "treemap", label: "Treemap", icon: LayoutGrid },
  { id: "cloud", label: "Cloud", icon: Cloud },
];

/* ══════════════════════════════════════════════════════
   Context menu
   ══════════════════════════════════════════════════════ */

function CodeContextMenu({
  x, y, cat, onClose, onAction,
}: {
  x: number; y: number; cat: Category;
  onClose: () => void;
  onAction: (action: string, cat: Category) => void;
}) {
  const sections = [
    {
      label: "Create",
      items: [
        { id: "subcategory", label: "+ Subcategory" },
        { id: "clone", label: "+ Clone (no citations)" },
        { id: "duplicate", label: "Duplicate with links" },
      ],
    },
    {
      label: "Edit",
      items: [
        { id: "properties", label: "Properties" },
        { id: "color", label: "Color" },
        { id: "rename", label: "Rename (F2)" },
      ],
    },
    {
      label: "Organize",
      items: [
        { id: "split", label: "Split" },
        { id: "merge", label: "Merge" },
        { id: "convert-sub", label: "Convert to subcategory of..." },
      ],
    },
    {
      label: "View",
      items: [
        { id: "isolate", label: "Isolate branch" },
        { id: "show-all", label: "Show all" },
      ],
    },
    {
      label: "Analysis",
      items: [
        { id: "read-citations", label: "Read citations" },
        { id: "distribution", label: "Distribution" },
        { id: "view-network", label: "View in network" },
        { id: "word-freq", label: "Word frequency" },
      ],
    },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[200]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="fixed z-[210] min-w-[220px] rounded-lg border py-1 shadow-xl"
        style={{ left: Math.min(x, window.innerWidth - 230), top: Math.min(y, window.innerHeight - 300),
          borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }} role="menu">
        {sections.map((sec) => (
          <div key={sec.label}>
            <div className="px-3 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-wider opacity-30"
              style={{ color: "var(--text-secondary)" }}>{sec.label}</div>
            {sec.items.map((item) => (
              <button key={item.id}
                onClick={() => { onAction(item.id, cat); onClose(); }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-100 min-touch"
                style={{ color: "var(--text-primary)" }} role="menuitem">
                {item.label}
              </button>
            ))}
          </div>
        ))}
        <div className="mx-2 my-1 border-t" style={{ borderColor: "var(--border)" }} />
        <button
          onClick={() => { onAction("delete", cat); onClose(); }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-red-50 min-touch"
          style={{ color: "#F44336" }} role="menuitem">
          Delete
        </button>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   Tree node (drag-and-drop)
   ══════════════════════════════════════════════════════ */

function TreeNode({
  cat, children_, depth, searchTerm,
  onSelect, onContextMenu, onDragStart, onDrop,
}: {
  cat: Category; children_: Category[]; depth: number; searchTerm: string;
  onSelect: (cat: Category) => void;
  onContextMenu: (e: React.MouseEvent, cat: Category) => void;
  onDragStart: (e: React.DragEvent, cat: Category) => void;
  onDrop: (e: React.DragEvent, target: Category) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const hasChildren = children_.length > 0;

  // Highlight search match
  const searchLower = searchTerm.toLowerCase();
  const matchIndex = searchLower ? cat.name.toLowerCase().indexOf(searchLower) : -1;

  const isSmart = (cat as any).es_inteligente;
  const isInVivo = cat.es_in_vivo;

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, cat)}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onDrop(e, cat); }}
        onClick={() => onSelect(cat)}
        onContextMenu={(e) => onContextMenu(e, cat)}
        className={`group flex items-center gap-1 rounded px-2 cursor-pointer transition-colors min-touch ${
          dragOver ? "" : "hover:bg-peach-50"
        }`}
        style={{
          height: 36,
          paddingLeft: `${8 + depth * 16}px`,
          backgroundColor: dragOver ? "rgba(33,150,243,0.08)" : "transparent",
          borderBottom: dragOver ? "2px solid #2196F3" : "2px solid transparent",
        }}
      >
        {/* Drag grip */}
        <GripVertical size={12} className="opacity-0 group-hover:opacity-20 flex-shrink-0" />

        {/* Expand */}
        {hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }} className="flex-shrink-0 rounded p-0.5 hover:bg-gray-200">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* Color dot */}
        <span className="inline-block flex-shrink-0 rounded-full" style={{ width: 10, height: 10, backgroundColor: cat.color }} />

        {/* Smart indicator */}
        {isSmart && <Zap size={11} className="flex-shrink-0" style={{ color: "#2196F3" }} />}
        {isInVivo && <Sparkles size={11} className="flex-shrink-0" style={{ color: "#000" }} />}

        {/* Name with search highlight */}
        <span className="flex-1 truncate text-xs" style={{ color: "var(--text-primary)" }}>
          {matchIndex >= 0 ? (
            <>
              {cat.name.slice(0, matchIndex)}
              <mark className="bg-yellow-200">{cat.name.slice(matchIndex, matchIndex + searchTerm.length)}</mark>
              {cat.name.slice(matchIndex + searchTerm.length)}
            </>
          ) : (
            cat.name
          )}
        </span>

        {/* Spacer */}
        <span className="w-4" />

        {/* Segment count */}
        {cat.count > 0 && (
          <span className="flex-shrink-0 text-[10px] opacity-30">({cat.count})</span>
        )}

        {/* More button */}
        <button onClick={(e) => { e.stopPropagation(); onContextMenu(e, cat); }}
          className="flex-shrink-0 rounded p-0.5 opacity-0 group-hover:opacity-50 hover:opacity-100">
          <MoreHorizontal size={12} />
        </button>
      </div>

      {expanded && hasChildren && children_.map((child) => (
        <TreeNode key={child.id} cat={child} children_={[]} depth={depth + 1} searchTerm={searchTerm}
          onSelect={onSelect} onContextMenu={onContextMenu} onDragStart={onDragStart} onDrop={onDrop} />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   CODE TREE PANEL (main)
   ══════════════════════════════════════════════════════ */

export function CodeTreePanel() {
  const allCategories = useProjectStore((s) => s.categories);
  const addCategory = useProjectStore((s) => s.addCategory);
  const removeCategory = useProjectStore((s) => s.removeCategory);
  const updateCategory = useProjectStore((s) => s.updateCategory);
  const filterCodes = useFilterStore((s) => s.filtroCodigo);
  const filterActive = filterCodes.length > 0;
  const categories = filterActive ? allCategories.filter((c) => filterCodes.includes(c.id)) : allCategories;
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("tree");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; cat: Category } | null>(null);
  const [dragCat, setDragCat] = useState<Category | null>(null);
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<Category | null>(null);
  const [isolatedRootId, setIsolatedRootId] = useState<string | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [inspectedCategory, setInspectedCategory] = useState<Category | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"definition" | "segments" | "distribution" | "relations">("definition");

  const openInspector = useCallback((cat: Category, tab?: "definition" | "segments" | "distribution" | "relations") => {
    setInspectedCategory(cat);
    setInspectorTab(tab ?? "definition");
  }, []);

  // ── Parse search operators ──
  const searchTerms = search.toLowerCase().split(/\s+AND\s+/i).filter(Boolean);

  // ── Filter + search ──
  const filtered = categories.filter((cat) => {
    // Search
    if (searchTerms.length > 0) {
      const name = cat.name.toLowerCase();
      if (!searchTerms.every((term) => name.includes(term))) return false;
    }
    // Filter
    switch (filter) {
      case "with-segments": return cat.count > 0;
      case "without-segments": return cat.count === 0;
      case "smart": return !!(cat as any).es_inteligente;
      case "in-vivo": return !!cat.es_in_vivo;
      default: return true;
    }
  });

  const roots = filtered.filter((c) => !c.parentId);
  const getChildren = (parentId: string) => filtered.filter((c) => c.parentId === parentId);

  // ── Context menu actions ──
  // F2 keyboard shortcut for rename
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F2" && ctxMenu?.cat) {
        e.preventDefault();
        setEditingCat(ctxMenu.cat);
        setModalOpen(true);
        setCtxMenu(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [ctxMenu]);

  const handleContextAction = useCallback((action: string, cat: Category) => {
    switch (action) {
      case "rename":
      case "color":
        setEditingCat(cat);
        setModalOpen(true);
        break;
      case "properties":
        openInspector(cat);
        break;
      case "delete":
        setConfirmDeleteCat(cat);
        break;
      case "subcategory":
        addCategory({
          id: `c${Date.now()}`, name: "New subcategory", color: cat.color,
          parentId: cat.id, count: 0,
        });
        toast.success("Created", `Subcategory under "${cat.name}"`);
        break;
      case "clone":
        addCategory({
          id: `c${Date.now()}`, name: `${cat.name} (clone)`, color: cat.color,
          parentId: cat.parentId, count: 0, description: cat.description,
        });
        toast.success("Cloned", `"${cat.name}" cloned (without citations)`);
        break;
      case "duplicate":
        addCategory({
          id: `c${Date.now()}`, name: `${cat.name} (copy)`, color: cat.color,
          parentId: cat.parentId, count: cat.count, description: cat.description,
        });
        toast.success("Duplicated", `"${cat.name}" duplicated with links`);
        break;
      case "split":
        toast.info("Split", `Select subcategories to split "${cat.name}" into`);
        break;
      case "merge":
        toast.info("Merge", `Select a category to merge "${cat.name}" into`);
        break;
      case "convert-sub":
        toast.info("Convert", `Select a parent for "${cat.name}"`);
        break;
      case "isolate":
        setIsolatedRootId(cat.id);
        toast.success("Isolated", `Showing only "${cat.name}" branch`);
        break;
      case "show-all":
        setIsolatedRootId(null);
        toast.success("Showing all categories");
        break;
      case "read-citations":
        openInspector(cat, "segments");
        break;
      case "distribution":
        openInspector(cat, "distribution");
        break;
      case "view-network":
        openInspector(cat, "relations");
        break;
      case "word-freq":
        openInspector(cat, "definition");
        break;
      default:
        toast.info(action, `Action on "${cat.name}"`);
    }
  }, [addCategory, toast]);

  // Filter roots by isolated branch
  const displayRoots = isolatedRootId
    ? roots.filter((r) => r.id === isolatedRootId)
    : roots;

  // ── Drag-and-drop ──
  const handleDragStart = useCallback((e: React.DragEvent, cat: Category) => {
    setDragCat(cat);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ name: cat.name, color: cat.color, id: cat.id }));
    (e.currentTarget as HTMLElement).style.opacity = "0.5";
  }, []);

  const handleDrop = useCallback((_e: React.DragEvent, target: Category) => {
    if (!dragCat || dragCat.id === target.id) return;
    updateCategory(dragCat.id, { parentId: target.id });
    toast.success("Moved", `"${dragCat.name}" under "${target.name}"`);
    setDragCat(null);
  }, [dragCat, updateCategory, toast]);

  // ── Handle modal save ──
  const handleSave = useCallback((data: Partial<Category>) => {
    if (editingCat) {
      updateCategory(editingCat.id, data);
      toast.success("Updated", `"${data.name}" saved`);
    } else {
      addCategory({
        id: `c${Date.now()}`, name: data.name ?? "New category",
        color: data.color ?? "#F1D7FF", parentId: data.parentId ?? null, count: 0,
      });
      toast.success("Created", `"${data.name}" added`);
    }
    setEditingCat(null);
  }, [editingCat, updateCategory, addCategory, toast]);

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-panel)" }}>
      {/* ── Filter banner ── */}
      {filterActive && (
        <div className="flex items-center gap-2 px-3 py-1 text-[10px] font-medium" style={{ backgroundColor: "#4CAF50", color: "#fff" }}>
          <span>🔽 Mostrando {categories.length} de {allCategories.length} categorías filtradas</span>
          <button onClick={() => useFilterStore.getState().setFiltroCodigo([])} className="ml-auto rounded px-1.5 py-0 hover:bg-white/20" title="Quitar filtro de códigos">✕</button>
        </div>
      )}
      {/* Search bar */}
      <div className="flex items-center gap-1 border-b px-2 py-1.5" style={{ borderColor: "var(--border)" }}>
        <Search size={13} opacity={0.35} />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search codes (AND for multiple terms)..."
          className="flex-1 bg-transparent text-xs outline-none"
          style={{ color: "var(--text-primary)" }} />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5 border-b px-1.5 py-1" style={{ borderColor: "var(--border)" }}>
        <button onClick={() => { setEditingCat(null); setModalOpen(true); }}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium hover:bg-gray-100 min-touch"
          style={{ color: "var(--text-primary)" }} title="Ctrl+K">
          <Plus size={12} /> New
        </button>
        <button onClick={() => {
          setEditingCat(null);
          setModalOpen(true);
          // Pre-fill as smart code
        }}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch"
          style={{ color: "var(--text-secondary)" }} title="Smart code">
          <Zap size={12} /> Smart
        </button>
        <div className="flex-1" />
        <div className="relative">
          <button onClick={() => setShowMoreMenu((v) => !v)}
            className="rounded p-1 hover:bg-gray-100 min-touch" aria-label="More" title="Import/Export">
            <MoreHorizontal size={13} opacity={0.4} />
          </button>
          {showMoreMenu && (
            <>
              <div className="fixed inset-0 z-50" onClick={() => setShowMoreMenu(false)} />
              <div className="absolute right-0 top-full z-50 mt-1 w-[160px] rounded-md border bg-white py-1 shadow-lg"
                style={{ borderColor: "var(--border)" }}>
                <button onClick={() => { setShowMoreMenu(false); toast.info("Import Excel", "Import categories from .xlsx file"); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-100"
                  style={{ color: "var(--text-primary)" }}><Upload size={12} /> Import Excel</button>
                <button onClick={() => { setShowMoreMenu(false); toast.info("Export", "Export categories to .xlsx file"); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-100"
                  style={{ color: "var(--text-primary)" }}><Download size={12} /> Export</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Views */}
      <div className="flex items-center border-b px-2 py-0.5" style={{ borderColor: "var(--border)" }}>
        {VIEWS.map((v) => { const Icon = v.icon;
          return (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium min-touch ${view === v.id ? "opacity-100" : "opacity-40 hover:opacity-70"}`}
              style={{ color: view === v.id ? "#000" : "#000" }}>
              <Icon size={12} /> {v.label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center border-b px-2 py-0.5 gap-0.5" style={{ borderColor: "var(--border)" }}>
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors min-touch ${
              filter === f.id ? "bg-peach-500 text-white" : "hover:bg-gray-100"
            }`}
            style={{ color: filter === f.id ? "#fff" : "var(--text-secondary)" }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto py-1">
        {view === "tree" && (
          displayRoots.length === 0 ? (
            <EmptyState variant="no-codes" subtitle={search ? "No codes match your search" : isolatedRootId ? "Isolated branch is empty" : "Press + New to create your first code"}
              action={isolatedRootId ? <button onClick={() => setIsolatedRootId(null)} className="rounded-md border px-3 py-1.5 text-xs min-touch" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}><EyeOff size={12} className="inline mr-1" />Show all</button> : undefined} />
          ) : (
            displayRoots.map((root) => (
              <TreeNode key={root.id} cat={root} children_={getChildren(root.id)} depth={0}
                searchTerm={search}
                onSelect={(cat) => openInspector(cat)}
                onContextMenu={(e, cat) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, cat }); }}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
              />
            ))
          )
        )}

        {view === "list" && (
          <div className="space-y-0.5 p-2">
            {filtered.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-gray-100 cursor-pointer"
                style={{ color: "var(--text-primary)" }}>
                <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                {cat.es_in_vivo && <Sparkles size={11} style={{ color: "#000" }} />}
                <span className="flex-1 truncate">{cat.name}</span>
                <span className="opacity-30">({cat.count})</span>
              </div>
            ))}
          </div>
        )}

        {view === "treemap" && (
          <div className="flex flex-wrap gap-0.5 p-2 content-start">
            {filtered.length === 0 ? (
              <div className="flex h-full w-full items-center justify-center"><p className="text-xs opacity-20">No categories to display</p></div>
            ) : (
              filtered.map((cat) => {
                const size = Math.max(60, Math.min(200, cat.count * 20 + 60));
                return (
                  <div key={cat.id} className="flex items-center justify-center rounded-md border cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ width: size, height: size * 0.7, backgroundColor: cat.color + "25", borderColor: cat.color + "40" }}
                    title={`${cat.name} (${cat.count})`}>
                    <span className="text-[10px] font-medium text-center px-1 truncate" style={{ color: cat.color }}>{cat.name}</span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {view === "cloud" && (
          <div className="flex flex-wrap items-center justify-center gap-2 p-4 content-center h-full">
            {filtered.length === 0 ? (
              <p className="text-xs opacity-20">No categories to display</p>
            ) : (
              filtered.map((cat) => {
                const size = 10 + Math.min(28, cat.count * 2);
                return (
                  <span key={cat.id} className="cursor-pointer hover:opacity-70 transition-opacity font-semibold"
                    style={{ fontSize: size, color: cat.color, opacity: 0.4 + Math.min(0.6, cat.count * 0.05) }}
                    title={`${cat.name} (${cat.count})`}>{cat.name}</span>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <CodeContextMenu x={ctxMenu.x} y={ctxMenu.y} cat={ctxMenu.cat}
          onClose={() => setCtxMenu(null)} onAction={handleContextAction} />
      )}

      {/* Category modal */}
      <CategoryModal
        open={modalOpen}
        category={editingCat}
        categories={categories}
        onClose={() => { setModalOpen(false); setEditingCat(null); }}
        onSave={handleSave}
        onDelete={(id) => { removeCategory(id); toast.success("Deleted"); }}
      />

      {/* Category inspector (3.4) */}
      <CategoryInspector
        open={inspectedCategory !== null}
        category={inspectedCategory}
        initialTab={inspectorTab}
        onClose={() => setInspectedCategory(null)}
      />

      {/* Delete confirmation modal */}
      {confirmDeleteCat && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40" onClick={() => setConfirmDeleteCat(null)}>
          <div className="w-full max-w-xs rounded-xl p-5 shadow-xl" style={{ backgroundColor: "var(--bg-panel)" }} onClick={(e) => e.stopPropagation()}>
            <p className="mb-1 text-sm font-semibold" style={{ color: "#F44336" }}>Delete category?</p>
            <p className="mb-1 text-xs" style={{ color: "var(--text-primary)" }}>
              "{confirmDeleteCat.name}"
            </p>
            {confirmDeleteCat.count > 0 && (
              <p className="mb-3 text-xs" style={{ color: "#F44336" }}>
                ⚠ This category has {confirmDeleteCat.count} coded segment{confirmDeleteCat.count > 1 ? "s" : ""}. Deleting it will remove all associated coding.
              </p>
            )}
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setConfirmDeleteCat(null)}
                className="rounded-md border px-3 py-1.5 text-xs min-touch"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={() => {
                removeCategory(confirmDeleteCat.id);
                toast.success("Deleted", `"${confirmDeleteCat.name}" removed`);
                setConfirmDeleteCat(null);
              }}
                className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 min-touch">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CodeTreePanel;
