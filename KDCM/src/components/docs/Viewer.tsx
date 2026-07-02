import { useState, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { useLayoutStore } from "../../stores/layoutStore";
import type { ProjectDocument } from "../../stores/projectStore";

interface ViewerProps {
  document: ProjectDocument;
}

/**
 * Document viewer.
 *
 * Renders document content inside the center panel with zoom/scroll
 * controls. State (zoom, page, scroll position) is persisted per
 * document via layoutStore.
 */
export function Viewer({ document }: ViewerProps) {
  const [loading] = useState(true);
  const [error] = useState<string | null>(null);

  const zoom = useLayoutStore((s) => s.zoomDoc[document.id] ?? 1);
  const setZoom = useLayoutStore((s) => s.setZoomDoc);
  const page = useLayoutStore((s) => s.paginaDoc[document.id] ?? 1);
  const setPage = useLayoutStore((s) => s.setPaginaDoc);

  const zoomIn  = useCallback(() => setZoom(document.id, Math.min(3, zoom + 0.25)), [document.id, zoom, setZoom]);
  const zoomOut = useCallback(() => setZoom(document.id, Math.max(0.25, zoom - 0.25)), [document.id, zoom, setZoom]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div
        className="flex h-10 items-center gap-2 border-b px-3 text-xs"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}
      >
        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
          {document.name}
        </span>
        <div className="flex-1" />
        <span className="opacity-40">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomOut} className="rounded p-1 hover:bg-gray-100 min-touch" aria-label="Zoom out">
          <ZoomOut size={14} />
        </button>
        <button onClick={zoomIn} className="rounded p-1 hover:bg-gray-100 min-touch" aria-label="Zoom in">
          <ZoomIn size={14} />
        </button>
        <button onClick={() => setZoom(document.id, 1)} className="rounded p-1 hover:bg-gray-100 min-touch" aria-label="Reset zoom">
          <RotateCw size={14} />
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-6">
        {loading && (
          <div className="flex h-full items-center justify-center text-sm opacity-30">
            Loading document...
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center text-sm" style={{ color: "#F44336" }}>
            {error}
          </div>
        )}
        {!loading && !error && (
          <div
            className="mx-auto bg-white shadow-md"
            style={{
              maxWidth: `${800 * zoom}px`,
              minHeight: "500px",
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
          >
            {/* Document content rendered here by type-specific renderers */}
            <div className="p-8 text-sm leading-relaxed">
              <p className="text-gray-400 italic">
                [Document content — type-specific renderer for {document.type} will mount here]
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Page indicator */}
      {document.pageCount && document.pageCount > 1 && (
        <div
          className="flex h-8 items-center justify-center gap-2 border-t text-xs"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}
        >
          <button
            onClick={() => setPage(document.id, Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded px-2 py-0.5 hover:bg-gray-100 disabled:opacity-30"
          >
            ←
          </button>
          <span style={{ color: "var(--text-secondary)" }}>
            {page} / {document.pageCount}
          </span>
          <button
            onClick={() => setPage(document.id, Math.min(document.pageCount!, page + 1))}
            disabled={page >= document.pageCount}
            className="rounded px-2 py-0.5 hover:bg-gray-100 disabled:opacity-30"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}

export default Viewer;
