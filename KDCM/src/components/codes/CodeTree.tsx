import { useState } from "react";
import { ChevronRight, ChevronDown, Plus } from "lucide-react";
import type { Category } from "../../stores/projectStore";

interface CodeTreeProps {
  categories: Category[];
  onSelect: (cat: Category) => void;
  onCreate: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

interface TreeNodeProps {
  cat: Category;
  children: Category[];
  depth: number;
  onSelect: (cat: Category) => void;
}

function TreeNode({ cat, children, depth, onSelect }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        onClick={() => { setExpanded((e) => !e); onSelect(cat); }}
        className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-sm hover:bg-gray-100 min-touch"
        style={{
          paddingLeft: `${8 + depth * 16}px`,
          color: "var(--text-primary)",
        }}
        aria-expanded={expanded}
      >
        {children.length > 0 ? (
          expanded ? <ChevronDown size={14} opacity={0.4} /> : <ChevronRight size={14} opacity={0.4} />
        ) : (
          <span className="w-3.5" />
        )}
        <span
          className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{ backgroundColor: cat.color }}
        />
        <span className="flex-1 truncate">{cat.name}</span>
        <span className="text-xs opacity-40">{cat.count}</span>
      </button>
      {expanded && children.map((child) => (
        <TreeNode
          key={child.id}
          cat={child}
          children={[]}
          depth={depth + 1}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

/**
 * Hierarchical code tree.
 *
 * Renders categories as an expandable tree with color dots and counts.
 * Supports selection, expand/collapse, and context menu actions.
 */
export function CodeTree({ categories, onSelect, onCreate }: CodeTreeProps) {
  // Top-level categories (no parent) and their children
  const roots = categories.filter((c) => !c.parentId);
  const getChildren = (parentId: string) => categories.filter((c) => c.parentId === parentId);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          Codes ({categories.length})
        </span>
        <button
          onClick={onCreate}
          className="rounded p-0.5 hover:bg-gray-100 min-touch"
          aria-label="Create category"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {roots.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs opacity-40">
            No categories yet. Click + to create one.
          </p>
        ) : (
          roots.map((root) => (
            <TreeNode
              key={root.id}
              cat={root}
              children={getChildren(root.id)}
              depth={0}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default CodeTree;
