import type { Category } from "../../stores/projectStore";

interface InspectorProps {
  category: Category | null;
  onUpdate: (id: string, patch: Partial<Category>) => void;
  onDelete: (id: string) => void;
}

/**
 * Category inspector panel.
 *
 * Shows details for the selected category and allows editing
 * its name, color, description, and parent.
 */
export function Inspector({ category, onUpdate, onDelete }: InspectorProps) {
  if (!category) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-xs opacity-30">Select a category to inspect</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
        Category details
      </h3>

      {/* Name */}
      <div>
        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Name
        </label>
        <input
          type="text"
          value={category.name}
          onChange={(e) => onUpdate(category.id, { name: e.target.value })}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
        />
      </div>

      {/* Color */}
      <div>
        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Color
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={category.color}
            onChange={(e) => onUpdate(category.id, { color: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded border"
            style={{ borderColor: "var(--border)" }}
          />
          <span className="text-xs font-mono opacity-50">{category.color}</span>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
          Description
        </label>
        <textarea
          value={category.description ?? ""}
          onChange={(e) => onUpdate(category.id, { description: e.target.value })}
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm outline-none resize-none"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
        />
      </div>

      {/* Stats */}
      <div className="rounded-md p-3" style={{ backgroundColor: "var(--bg-secondary)" }}>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Coded segments: <span className="font-semibold">{category.count}</span>
        </p>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(category.id)}
        className="w-full rounded-md border border-red-300 py-2 text-sm font-medium text-red-600 hover:bg-red-50 min-touch"
      >
        Delete category
      </button>
    </div>
  );
}

export default Inspector;
