import { useEffect, useRef } from "react";

export interface ContextMenuItem {
  label?: string;
  action?: () => void;
  danger?: boolean;
  separator?: true;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/**
 * Right-click context menu.
 *
 * Items: Rename | Color | Move | Group | Collection | Portrait |
 *        Duplicate | Properties | — | Delete
 *
 * Auto-closes on click outside or Escape.
 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[200] min-w-[180px] rounded-lg border py-1 shadow-xl"
      style={{
        left: Math.min(x, window.innerWidth - 190),
        top: Math.min(y, window.innerHeight - items.length * 32 - 16),
        borderColor: "var(--border)",
        backgroundColor: "var(--bg-panel)",
      }}
      role="menu"
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
        ) : (
          <button
            key={i}
            onClick={() => { item.action?.(); onClose(); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-100 min-touch"
            style={{ color: item.danger ? "#F44336" : "var(--text-primary)" }}
            role="menuitem"
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}

export default ContextMenu;
