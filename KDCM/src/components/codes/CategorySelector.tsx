import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Plus, Check, ChevronRight, ChevronDown, Sparkles, X } from "lucide-react";
import { useCodingStore } from "../../stores/codingStore";
import { useProjectStore, type Category } from "../../stores/projectStore";

interface Props {
  open: boolean;
  selectedText: string;
  segmentId?: string;
  onClose: () => void;
  onApply: (categoryId: string, weight: number) => void;
}

/**
 * Category selector — slides in from the right (320px).
 *
 * - Header: peach-700 with selected text preview (Lora italic, 60 chars)
 * - Quick access: 5 recent category chips
 * - Search input with autofocus + filterable tree
 * - Click: apply & close. Ctrl+click: apply without closing (multi).
 * - Footer: weight slider + new category button + apply & close
 */
export function CategorySelector({ open, selectedText, segmentId: _sid, onClose, onApply }: Props) {
  const categories = useProjectStore((s) => s.categories);
  const addCategory = useProjectStore((s) => s.addCategory);
  const recentIds = useCodingStore((s) => s.recentCategories);
  const pushRecent = useCodingStore((s) => s.pushRecent);

  const [search, setSearch] = useState("");
  const [weight, setWeight] = useState(50);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Autofocus search on open
  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open]);

  // Reset on open
  useEffect(() => {
    if (open) { setSearch(""); setWeight(50); setShowNew(false); }
  }, [open]);

  const handleApply = useCallback((catId: string, multi: boolean) => {
    pushRecent(catId);
    onApply(catId, weight);
    if (!multi) onClose();
  }, [pushRecent, onApply, weight, onClose]);

  // Filter tree
  const searchLower = search.toLowerCase();
  const filtered = searchLower
    ? categories.filter((c) => c.name.toLowerCase().includes(searchLower))
    : categories;

  const roots = filtered.filter((c) => !c.parentId);
  const getChildren = (parentId: string) => filtered.filter((c) => c.parentId === parentId);

  // Recent categories (last 5)
  const recentCats = recentIds
    .map((id) => categories.find((c) => c.id === id))
    .filter(Boolean) as Category[];

  // Unique category colors for new
  const randomColor = `#${Math.floor(0 * 0xffffff).toString(16).padStart(6, "0")}`;

  const handleCreateCategory = () => {
    if (!newName.trim()) return;
    addCategory({
      id: `c${Date.now()}`,
      name: newName.trim(),
      color: randomColor,
      parentId: null,
      count: 0,
    });
    setNewName("");
    setShowNew(false);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-[320px] flex-col shadow-2xl"
        style={{
          backgroundColor: "var(--bg-panel)",
          animation: "cat-slide-in 250ms ease-out",
        }}
      >
        <style>{`
          @keyframes cat-slide-in {
            from { transform: translateX(320px); }
            to   { transform: translateX(0); }
          }
        `}</style>

        {/* ═══ Header (peach-700) ═══ */}
        <div className="flex-shrink-0 bg-peach-700 px-4 py-3 text-white">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-semibold">Code segment</span>
            <button onClick={onClose} className="rounded p-0.5 hover:bg-white/10"><X size={16} /></button>
          </div>
          <p className="text-xs italic opacity-80 line-clamp-2"
            style={{ fontFamily: "'Lora', Georgia, serif" }}>
            &ldquo;{selectedText.slice(0, 60)}{selectedText.length > 60 ? "..." : ""}&rdquo;
          </p>
        </div>

        {/* ═══ Quick access chips (last 5) ═══ */}
        {recentCats.length > 0 && (
          <div className="flex-shrink-0 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
            <p className="mb-1.5 text-[10px] font-medium opacity-40">Recent</p>
            <div className="flex flex-wrap gap-1">
              {recentCats.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleApply(cat.id, false)}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors hover:opacity-80"
                  style={{ backgroundColor: cat.color + "20", color: cat.color, border: `1px solid ${cat.color}40` }}
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Search ═══ */}
        <div className="flex-shrink-0 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5"
            style={{ borderColor: search ? "var(--peach)" : "var(--border)" }}>
            <Search size={13} opacity={0.35} />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories..."
              className="flex-1 bg-transparent text-xs outline-none"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
        </div>

        {/* ═══ Category tree ═══ */}
        <div className="flex-1 overflow-y-auto py-1">
          {roots.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs opacity-30">No categories match</p>
          ) : (
            roots.map((root) => (
              <TreeNode
                key={root.id}
                cat={root}
                children_={getChildren(root.id)}
                depth={0}
                onApply={handleApply}
                quickSlots={[]}
                onSetQuick={() => {}}
              />
            ))
          )}
        </div>

        {/* ═══ Footer ═══ */}
        <div className="flex-shrink-0 border-t px-4 py-3 space-y-3" style={{ borderColor: "var(--border)" }}>
          {/* Weight slider */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] opacity-40 w-10">Weight</span>
            <input
              type="range" min={1} max={100} value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              className="flex-1" style={{ accentColor: "var(--peach)" }}
            />
            <span className="text-[11px] font-mono opacity-50 w-8 text-right">{weight}</span>
          </div>

          {/* New category */}
          {showNew ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); if (e.key === "Escape") setShowNew(false); }}
                placeholder="Category name"
                className="flex-1 rounded-md border px-2.5 py-1.5 text-xs outline-none"
                style={{ borderColor: "var(--peach)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
              />
              <button onClick={handleCreateCategory} className="rounded-md bg-peach-500 px-2.5 py-1.5 text-xs font-medium text-white">Add</button>
            </div>
          ) : (
            <button
              onClick={() => setShowNew(true)}
              className="flex w-full items-center justify-center gap-1 rounded-md border py-2 text-xs font-medium hover:bg-gray-50 min-touch"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              <Plus size={13} /> New category
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Tree node (recursive) ── */

function TreeNode({
  cat, children_, depth, onApply, quickSlots, onSetQuick,
}: {
  cat: Category; children_: Category[]; depth: number;
  onApply: (catId: string, multi: boolean) => void;
  quickSlots: (string | null)[];
  onSetQuick: (slot: number, catId: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = children_.length > 0;

  return (
    <div>
      <div
        className="group flex items-center gap-1.5 rounded px-2 py-1.5 text-xs cursor-pointer transition-colors hover:bg-gray-100 min-touch"
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey) {
            onApply(cat.id, true);
          } else {
            onApply(cat.id, false);
          }
        }}
        title="Click: apply & close · Ctrl+Click: apply multiple"
      >
        {/* Expand/collapse */}
        {hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }} className="flex-shrink-0 rounded p-0.5 hover:bg-gray-200">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Color dot */}
        <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />

        {/* Name */}
        <span className="flex-1 truncate" style={{ color: "var(--text-primary)" }}>{cat.name}</span>

        {/* Count */}
        <span className="text-[10px] opacity-30">{cat.count}</span>

        {/* In-vivo indicator */}
        {cat.es_in_vivo && <Sparkles size={11} style={{ color: "#000" }} />}

        {/* Apply icon on hover */}
        <Check size={13} className="opacity-0 group-hover:opacity-50 transition-opacity" />
      </div>

      {expanded && hasChildren && children_.map((child) => (
        <TreeNode key={child.id} cat={child} children_={[]} depth={depth + 1} onApply={onApply} quickSlots={quickSlots} onSetQuick={onSetQuick} />
      ))}
    </div>
  );
}

export default CategorySelector;
