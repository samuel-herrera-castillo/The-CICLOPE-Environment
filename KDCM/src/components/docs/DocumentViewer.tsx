import { useState, useCallback, useRef, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, Search, X,
  User, Tag, Edit3, Printer, Sidebar,
} from "lucide-react";
import { useLayoutStore } from "../../stores/layoutStore";
import { useUIStore } from "../../stores/uiStore";
import { useProjectStore } from "../../stores/projectStore";
import { useCodingStore } from "../../stores/codingStore";
import { useToast } from "../../stores/toastStore";
import { usePositionMemory } from "../../lib/positionMemory";
import { getDocumentContent } from "../../lib/tauriBridge";
import { setTTSWordHighlightCallback, setTTSBoundaryCallback } from "../../stores/ttsStore";
import { SelectionPanel } from "./SelectionPanel";
import { CategorySelector } from "../codes/CategorySelector";
import { ViewerSearch } from "./ViewerSearch";
import type { ProjectDocument } from "../../stores/projectStore";
import * as pdfjs from "pdfjs-dist";

// Configure PDF.js worker — served from public/ directory
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface ViewerProps {
  document: ProjectDocument;
  onClose?: () => void;
}

/* ── Breadcrumb ── */
function Breadcrumb({ name, page, total }: { name: string; page: number; total: number }) {
  return (
    <div
      className="flex h-[28px] items-center gap-2 border-b px-3 text-[11px]"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}
    >
      <span className="opacity-40">📁</span>
      <span className="opacity-60">{name}</span>
      <span className="opacity-25">›</span>
      <span className="opacity-40">Pág. {page}</span>
      {total > 1 && <span className="opacity-25">/ {total}</span>}
    </div>
  );
}

/* ── Toolbar ── */
function Toolbar({
  page, total, zoom, searchOpen, marginMode,
  onPrev, onNext, onZoom, onSearchToggle, onMarginToggle, onPrint,
}: {
  page: number; total: number; zoom: number; searchOpen: boolean;
  marginMode: "category" | "coder";
  onPrev: () => void; onNext: () => void; onZoom: (z: number) => void;
  onSearchToggle: () => void; onMarginToggle: () => void; onPrint: () => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);
  const [onlyCoded, setOnlyCoded] = useState(false);

  return (
    <div
      className="flex h-[40px] items-center gap-2 border-b px-3 text-xs"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}
    >
      {/* Navigation */}
      <button onClick={onPrev} disabled={page <= 1} className="rounded p-1 hover:bg-gray-100 disabled:opacity-30 min-touch" aria-label="Previous page">
        <ChevronLeft size={14} />
      </button>
      <span className="font-mono text-[11px] opacity-60">{page}/{total || 1}</span>
      <button onClick={onNext} disabled={page >= total} className="rounded p-1 hover:bg-gray-100 disabled:opacity-30 min-touch" aria-label="Next page">
        <ChevronRight size={14} />
      </button>

      <div className="w-px h-4 opacity-20" style={{ backgroundColor: "var(--text-secondary)" }} />

      {/* Zoom */}
      <select
        value={zoom}
        onChange={(e) => onZoom(Number(e.target.value))}
        className="rounded border px-1.5 py-0.5 text-[11px] bg-transparent"
        style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        aria-label="Zoom level"
      >
        {[50, 75, 100, 125, 150, 200].map((z) => (
          <option key={z} value={z / 100}>{z}%</option>
        ))}
      </select>

      {/* Search — enhanced */}
      {searchOpen ? (
        <div className="flex items-center gap-0.5" style={{ borderColor: "var(--peach)" }}>
          <div className="flex items-center gap-0.5 rounded border px-1.5 py-0.5" style={{ borderColor: "var(--peach)" }}>
            <Search size={11} opacity={0.5} />
            <input autoFocus type="text" value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
                setMatchIndex(0);
                setTotalMatches(e.target.value ? 0 + 1 : 0);
              }}
              placeholder="Find..."
              className="w-[100px] bg-transparent text-[11px] outline-none"
              style={{ color: "var(--text-primary)" }}
              onKeyDown={(e) => {
                if (e.key === "Escape") onSearchToggle();
                if (e.key === "Enter") {
                  setMatchIndex((i) => (i + 1) % Math.max(1, totalMatches));
                }
              }} />
            {totalMatches > 0 && (
              <span className="text-[10px] font-mono opacity-40">{matchIndex + 1}/{totalMatches}</span>
            )}
          </div>
          <button onClick={() => setMatchIndex((i) => Math.max(0, i - 1))} disabled={matchIndex <= 0}
            className="rounded p-0.5 hover:bg-gray-100 disabled:opacity-20" aria-label="Previous match" title="Previous">←</button>
          <button onClick={() => setMatchIndex((i) => (i + 1) % Math.max(1, totalMatches))} disabled={totalMatches <= 1}
            className="rounded p-0.5 hover:bg-gray-100 disabled:opacity-20" aria-label="Next match" title="Next">→</button>
          <button onClick={() => setCaseSensitive((c) => !c)}
            className={`rounded px-1 py-0.5 text-[10px] font-medium min-touch ${caseSensitive ? "bg-peach-100" : "hover:bg-gray-100 opacity-50"}`}
            style={{ color: caseSensitive ? "#000" : "#000" }} title="Case sensitive">Aa</button>
          <button onClick={() => setWholeWord((w) => !w)}
            className={`rounded px-1 py-0.5 text-[10px] font-medium min-touch ${wholeWord ? "bg-peach-100" : "hover:bg-gray-100 opacity-50"}`}
            style={{ color: wholeWord ? "#000" : "#000" }} title="Whole word">\b</button>
          <button onClick={() => setUseRegex((r) => !r)}
            className={`rounded px-1 py-0.5 text-[10px] font-medium min-touch ${useRegex ? "bg-peach-100" : "hover:bg-gray-100 opacity-50"}`}
            style={{ color: useRegex ? "#000" : "#000" }} title="Regex">.*</button>
          <button onClick={onSearchToggle} className="rounded p-0.5 hover:bg-gray-100"><X size={12} /></button>
        </div>
      ) : (
        <button onClick={onSearchToggle} className="rounded p-1 hover:bg-gray-100 min-touch" aria-label="Search (Ctrl+F)" title="Search (Ctrl+F)">
          <Search size={14} opacity={0.5} />
        </button>
      )}

      {/* Extra search filters (only when search is open) */}
      {searchOpen && searchText && (
        <>
          <div className="w-px h-4 opacity-10" style={{ backgroundColor: "var(--text-secondary)" }} />
          <label className="flex items-center gap-1 text-[9px] cursor-pointer opacity-40 hover:opacity-70" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={onlyBookmarked} onChange={(e) => setOnlyBookmarked(e.target.checked)} style={{ accentColor: "var(--peach)" }} /> Bookmarked
          </label>
          <label className="flex items-center gap-1 text-[9px] cursor-pointer opacity-40 hover:opacity-70" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={onlyCoded} onChange={(e) => setOnlyCoded(e.target.checked)} style={{ accentColor: "var(--peach)" }} /> Coded only
          </label>
        </>
      )}

      <div className="flex-1" />

      {/* Coder / Category margin toggle */}
      <button
        onClick={onMarginToggle}
        className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium min-touch ${
          marginMode === "coder" ? "opacity-100" : "opacity-50 hover:opacity-80"
        }`}
        style={{ color: "var(--text-primary)" }}
        title="Toggle margin mode"
      >
        {marginMode === "coder" ? <User size={12} /> : <Tag size={12} />}
        {marginMode === "category" ? "Category" : "Coder"}
      </button>

      {/* Paraphrase / Edit / Print */}
      <button
        className="rounded p-1 hover:bg-gray-100 min-touch" aria-label="Paraphrase" title="Select text and use the floating panel to paraphrase">
        <Edit3 size={14} opacity={0.5} />
      </button>
      <button onClick={onPrint} className="rounded p-1 hover:bg-gray-100 min-touch" aria-label="Print">
        <Printer size={14} opacity={0.5} />
      </button>
    </div>
  );
}

/* ── Page thumbnails column ── */
function Thumbnails({ total, page, onPage }: { total: number; page: number; onPage: (n: number) => void }) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex w-[20px] flex-shrink-0 items-center justify-center border-r hover:bg-gray-100"
        style={{ borderColor: "var(--border)" }}
        aria-label="Expand thumbnails"
      >
        <ChevronRight size={12} opacity={0.4} />
      </button>
    );
  }

  return (
    <div
      className="flex w-[72px] flex-shrink-0 flex-col border-r"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}
    >
      <button
        onClick={() => setCollapsed(true)}
        className="flex h-6 items-center justify-end px-1 hover:bg-gray-100"
        aria-label="Collapse thumbnails"
      >
        <ChevronLeft size={12} opacity={0.3} />
      </button>
      <div className="flex-1 overflow-y-auto px-1.5 py-1 space-y-1.5">
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onPage(n)}
            className="flex h-12 w-full items-center justify-center rounded border text-[10px] font-medium transition-all hover:bg-white"
            style={{
              borderColor: n === page ? "var(--peach)" : "var(--border)",
              backgroundColor: n === page ? "var(--bg-primary)" : "transparent",
              color: n === page ? "#000" : "#000",
              borderWidth: n === page ? 2 : 1,
            }}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Citation margin ── */
interface CodedSegment {
  id: string;
  startY: number;
  endY: number;
  color: string;
  codeName: string;
  coderName?: string;
  coderColor?: string;
  weight?: number;
}

function CitationMargin({
  segments, mode, width, onSegmentClick,
}: {
  segments: CodedSegment[];
  mode: "category" | "coder";
  width: number;
  onSegmentClick: (id: string) => void;
}) {
  return (
    <div
      className="relative flex-shrink-0 border-l"
      style={{ width, borderColor: "var(--border)", minHeight: 400 }}
    >
      {segments.map((seg) => (
        <div
          key={seg.id}
          className="absolute left-0 cursor-pointer transition-opacity hover:opacity-80"
          style={{
            top: seg.startY,
            height: Math.max(4, seg.endY - seg.startY),
            width: mode === "category" ? 8 : width - 4,
            backgroundColor: mode === "category" ? seg.color : undefined,
            borderRadius: mode === "category" ? 2 : undefined,
          }}
          onClick={() => onSegmentClick(seg.id)}
          title={`${seg.codeName}${seg.coderName ? ` — ${seg.coderName}` : ""}${seg.weight ? ` (${seg.weight}%)` : ""}`}
        >
          {mode === "coder" && (
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm"
              style={{ backgroundColor: seg.coderColor ?? seg.color, marginLeft: 2 }}
            >
              {(seg.coderName ?? seg.codeName).charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Segment resize circles (appear on click of existing citation) ── */
function SegmentResizeHandles({ top, bottom, onDragTop, onDragBottom }: {
  top: number; bottom: number;
  onDragTop: (delta: number) => void;
  onDragBottom: (delta: number) => void;
}) {
  return (
    <>
      {/* Start handle */}
      <div
        className="absolute z-30 h-2 w-2 rounded-full border-2 bg-white cursor-ns-resize"
        style={{ top: top - 4, left: "50%", marginLeft: -4, borderColor: "var(--peach)" }}
        onMouseDown={(e) => {
          e.stopPropagation();
          const startY = e.clientY;
          const onMove = (ev: MouseEvent) => onDragTop(ev.clientY - startY);
          const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }}
      />
      {/* End handle */}
      <div
        className="absolute z-30 h-2 w-2 rounded-full border-2 bg-white cursor-ns-resize"
        style={{ top: bottom - 4, left: "50%", marginLeft: -4, borderColor: "var(--peach)" }}
        onMouseDown={(e) => {
          e.stopPropagation();
          const startY = e.clientY;
          const onMove = (ev: MouseEvent) => onDragBottom(ev.clientY - startY);
          const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup", onUp);
        }}
      />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   DOCUMENT VIEWER (main)
   ══════════════════════════════════════════════════════════════ */

export function DocumentViewer({ document }: ViewerProps) {
  const zoom = useLayoutStore((s) => s.zoomDoc[document.id] ?? 1);
  const page = useLayoutStore((s) => s.paginaDoc[document.id] ?? 1);
  const scroll = useLayoutStore((s) => s.scrollDoc[document.id]);
  const setZoom = useLayoutStore((s) => s.setZoomDoc);
  const setPage = useLayoutStore((s) => s.setPaginaDoc);
  const setScroll = useLayoutStore((s) => s.setScrollDoc);
  const focusMode = useUIStore((s) => s.focusMode);
  const toggleFocus = useUIStore((s) => s.toggleFocusMode);

  const proyectoId = useProjectStore((s) => s.project?.id);
  const { restorePosition, savePage: savePosPage, saveZoom: savePosZoom, flushPosition } = usePositionMemory(document.id, proyectoId);
  const [posRestoredToast, setPosRestoredToast] = useState("");

  // Restore position on mount
  useEffect(() => {
    restorePosition().then((pos) => {
      if (pos) {
        if (pos.pagina && pos.pagina > 1) {
          setPage(document.id, pos.pagina);
          // Toast sutil 3s esquina inferior izquierda
          setPosRestoredToast(`↩ Continuando desde la página ${pos.pagina}`);
          setTimeout(() => setPosRestoredToast(""), 3000);
        }
        if (pos.zoom && pos.zoom !== 1) setZoom(document.id, pos.zoom);
        if (pos.scroll_y && pos.scroll_y > 0) {
          setTimeout(() => {
            const el = window.document.getElementById(`doc-content-${document.id}`);
            if (el) el.scrollTop = pos.scroll_y;
          }, 150);
        }
      }
    });
  }, [document.id]);

  // Save position on page/scroll/zoom change
  const prevPage = useRef(page);
  const prevZoom = useRef(zoom);
  useEffect(() => { if (page !== prevPage.current) { prevPage.current = page; savePosPage(page, scroll?.y ?? 0, zoom); } }, [page]);
  useEffect(() => { if (zoom !== prevZoom.current) { prevZoom.current = zoom; savePosZoom(zoom); } }, [zoom]);

  // Flush all pending position saves on unmount (close doc / change tab)
  useEffect(() => { return () => { flushPosition(); }; }, [document.id]);

  const [marginMode, setMarginMode] = useState<"category" | "coder">("category");
  const [marginWidth, setMarginWidth] = useState(focusMode ? 60 : 48);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);

  // Ctrl+F keyboard listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<string>("");
  const [showCategorySelector, setShowCategorySelector] = useState(false);

  // ── PDF rendering state ──
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pdfRenderError, setPdfRenderError] = useState<string | null>(null);

  // Register TTS word highlight callback (after docContent declared)
  useEffect(() => {
    // Remove previous highlight on new calls
    let currentHighlight: HTMLSpanElement | null = null;
    setTTSWordHighlightCallback((charIndex: number) => {
      if (!docContent || charIndex < 0 || charIndex >= docContent.length) return;
      const container = window.document.getElementById(`doc-content-${document.id}`);
      if (!container) return;

      // Remove previous highlight
      if (currentHighlight) { currentHighlight.remove(); currentHighlight = null; }

      // Find the word boundaries around charIndex
      const before = docContent.slice(0, charIndex);
      const after = docContent.slice(charIndex);
      const wordMatchBefore = before.match(/(\S+)$/);
      const wordMatchAfter = after.match(/^(\S+)/);
      const wordStart = charIndex - (wordMatchBefore ? wordMatchBefore[1].length : 0);
      const wordEnd = charIndex + (wordMatchAfter ? wordMatchAfter[1].length : 0);
      const word = docContent.slice(wordStart, wordEnd) || docContent.slice(Math.max(0, charIndex - 3), Math.min(docContent.length, charIndex + 10));

      // Scroll to approximate position
      const ratio = charIndex / docContent.length;
      container.scrollTop = ratio * container.scrollHeight;

      // Create highlight overlay at approximate position
      const highlight = window.document.createElement("span");
      highlight.className = "tts-word-highlight";
      highlight.textContent = word.slice(0, 20);
      highlight.style.cssText = "position:absolute;left:48px;right:48px;background:#FFEE8A;color:#1a1a1a;padding:2px 6px;border-radius:3px;font-size:inherit;line-height:inherit;pointer-events:none;z-index:20;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 3px rgba(0,0,0,0.12)";
      // Position at the approximate Y based on charIndex ratio
      const contentEl = container.querySelector("[style]") || container.firstElementChild;
      if (contentEl) {
        const contentHeight = (contentEl as HTMLElement).offsetHeight || container.scrollHeight;
        const topOffset = ratio * contentHeight;
        (highlight as any).style.top = `${topOffset}px`;
      }
      // Insert into container
      container.style.position = container.style.position || "relative";
      container.appendChild(highlight);
      currentHighlight = highlight;

      // Auto-remove after 1.5s
      setTimeout(() => { if (currentHighlight === highlight) { highlight.remove(); currentHighlight = null; } }, 1500);
    });
    return () => { setTTSWordHighlightCallback(null); setTTSBoundaryCallback(null); if (currentHighlight) currentHighlight.remove(); };
  }, [docContent, document.id]);

  // Also register boundary callback for more precise word extraction
  useEffect(() => {
    setTTSBoundaryCallback((charIndex: number, _charLength: number) => {
      if (!docContent || charIndex < 0 || charIndex >= docContent.length) return;
      // The highlight is already handled by setTTSWordHighlightCallback above
      // This boundary provides charLength for future improvements
    });
    return () => setTTSBoundaryCallback(null);
  }, [docContent, document.id]);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState("");
  const { toast } = useToast();
  const addCategory = useProjectStore((s) => s.addCategory);
  const updateCategory = useProjectStore((s) => s.updateCategory);
  const pushRecent = useCodingStore((s) => s.pushRecent);
  const toggleKeyEvidence = useCodingStore((s) => s.toggleKeyEvidence);
  const addSegmentComment = useCodingStore((s) => s.addSegmentComment);
  const keyEvidence = useCodingStore((s) => s.keyEvidence);
  const setInspectedSegment = useUIStore((s) => s.setInspectedSegment);
  const addMemo = useProjectStore((s) => s.addMemo);
  const highlightTarget = useLayoutStore((s) => s.highlightTarget);
  const setHighlightTarget = useLayoutStore((s) => s.setHighlightTarget);

  // Parse highlight target for this document
  const highlightSnippet = (() => {
    if (!highlightTarget || !docContent) return null;
    try {
      const data = JSON.parse(highlightTarget);
      if (data.type === "text" && data.docId === document.id) return data.snippet as string;
    } catch { return null; }
    return null;
  })();

  // Clear highlight after content renders with highlight visible
  useEffect(() => {
    if (highlightSnippet && docContent && setHighlightTarget) {
      // Scroll to highlighted element
      const el = contentRef.current?.querySelector("mark[data-highlight]");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      const timer = setTimeout(() => setHighlightTarget(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [highlightSnippet, docContent, setHighlightTarget]);

  // Load real file content for text-based documents
  useEffect(() => {
    const isWebUrl = document.path?.startsWith("http://") || document.path?.startsWith("https://");

    if (document.type === "txt" || document.type === "rtf") {
      if (isWebUrl || !document.path) {
        // Web-imported or DB-stored document (e.g. transcription): load from SQLite
        getDocumentContent(document.id)
          .then((html) => {
            if (html) {
              setDocContent(html);
            } else {
              setDocContent("No content stored for this document.");
            }
          })
          .catch(() => setDocContent("Could not load file content."));
      } else {
        // Try localStorage first, then fetch from path
        const stored = (() => {
          try { return localStorage.getItem(`kdcm_doc_${document.id}`); }
          catch { return null; }
        })();
        if (stored) {
          setDocContent(stored);
        } else {
          fetch(document.path)
            .then((r) => r.text())
            .then((text) => setDocContent(text))
            .catch(() => setDocContent("Could not load file content."));
        }
      }
    } else if (document.type === "docx") {
      // Use mammoth.js to convert DOCX to HTML
      setDocContent("Loading DOCX content...");
      import("mammoth")
        .then((mammoth) => {
          fetch(document.path)
            .then((r) => r.arrayBuffer())
            .then((buf) => mammoth.convertToHtml({ arrayBuffer: buf }))
            .then((result) => setDocContent(`<style>p{margin:0 0 0.5em;} h1{font-size:1.5em;margin:0.5em 0;} h2{font-size:1.25em;margin:0.4em 0;} table{border-collapse:collapse;width:100%;} td,th{border:1px solid #ccc;padding:4px 8px;} img{max-width:100%;}</style>${result.value}`))
            .catch(() => setDocContent("Could not parse DOCX file."));
        })
        .catch(() => setDocContent("mammoth.js not available."));
    } else if (document.type === "pdf") {
      // Load PDF via pdfjs-dist
      setDocContent("");
      setPdfRenderError(null);
      const loadPdf = async () => {
        try {
          const loadingTask = pdfjs.getDocument({ url: document.path });
          const pdf = await loadingTask.promise;
          setPdfDoc(pdf);
          setPdfPageCount(pdf.numPages);
          // Store page count on the document for position memory
          if (pdf.numPages > 1) {
            setPage(document.id, Math.min(page, pdf.numPages));
          }
        } catch (err: any) {
          console.error("PDF load error:", err);
          setPdfRenderError(err?.message ?? "Could not load PDF file.");
        }
      };
      loadPdf();
      return () => {
        setPdfDoc(null);
        setPdfPageCount(0);
      };
    } else {
      setDocContent("");
    }
  }, [document.path, document.type, document.name]);

  // ── Render current PDF page to canvas ──
  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current || document.type !== "pdf") return;
    let cancelled = false;
    const renderPage = async () => {
      try {
        const pdfPage = await pdfDoc.getPage(page);
        const viewport = pdfPage.getViewport({ scale: zoom });
        const canvas = pdfCanvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await pdfPage.render({ canvas, viewport }).promise;
      } catch (err) {
        console.error("PDF page render error:", err);
      }
    };
    renderPage();
    return () => { cancelled = true; };
  }, [pdfDoc, page, zoom, document.type]);

  const contentRef = useRef<HTMLDivElement>(null);

  const totalPages = document.type === "pdf"
    ? (pdfPageCount || 1)
    : (document.pageCount ?? 1);

  // ── Position memory: restore on open ──
  useEffect(() => {
    if (scroll && contentRef.current) {
      contentRef.current.scrollTop = scroll.y;
    }
    // Toast notification
    if (page > 1) {
      // In production: use toast.info(`Continuando desde la página ${page}`);
    }
  }, []); // eslint-disable-line

  // ── Save scroll position on unmount ──
  useEffect(() => {
    return () => {
      if (contentRef.current) {
        setScroll(document.id, {
          x: contentRef.current.scrollLeft,
          y: contentRef.current.scrollTop,
        });
      }
    };
  }, [document.id, setScroll]);

  // ── Text selection handler ──
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelection({
      text: sel.toString().trim(),
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, []);

  // ── Focus mode: adjust margin ──
  useEffect(() => {
    setMarginWidth(focusMode ? 60 : 48);
  }, [focusMode]);

  // ── Margin segments (key evidence bookmarks) ──
  const demoSegments: CodedSegment[] = keyEvidence
    .filter((k) => k.startsWith(document.id))
    .map((_k, i) => ({
      id: `bm-${i}`,
      startY: 300 + i * 30,
      endY: 315 + i * 30,
      color: "#F59E0B",
      codeName: "⭐ Key evidence",
      weight: 100,
    }));

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb */}
      <Breadcrumb name={document.name} page={page} total={totalPages} />

      {/* Toolbar */}
      <Toolbar
        page={page} total={totalPages} zoom={zoom} searchOpen={searchOpen}
        marginMode={marginMode}
        onPrev={() => setPage(document.id, Math.max(1, page - 1))}
        onNext={() => setPage(document.id, Math.min(totalPages, page + 1))}
        onZoom={(z) => setZoom(document.id, z)}
        onSearchToggle={() => setSearchOpen((o) => !o)}
        onMarginToggle={() => setMarginMode((m) => m === "category" ? "coder" : "category")}
        onPrint={() => window.print()}
      />

      {/* Main area: thumbnails + content + margin */}
      <div className="flex flex-1 overflow-hidden">
        {/* Thumbnails (multi-page docs) */}
        {totalPages > 1 && (
          <Thumbnails total={totalPages} page={page} onPage={(n) => setPage(document.id, n)} />
        )}

        {/* ── ViewerSearch bar ── */}
        {searchOpen && (
          <ViewerSearch content={docContent} containerRef={searchContainerRef} onClose={() => setSearchOpen(false)} />
        )}

        {/* ── Document content ── */}
        <div ref={(el) => { (contentRef as any).current = el; (searchContainerRef as any).current = el; }} className="relative flex-1 overflow-auto" onMouseUp={handleMouseUp}>
          {/* Focus mode exit button */}
          {focusMode && (
            <button
              onClick={toggleFocus}
              className="fixed right-4 top-20 z-30 flex items-center gap-1 rounded-md border bg-white px-3 py-1.5 text-xs font-medium shadow-md hover:bg-gray-50"
              style={{ borderColor: "var(--border)" }}
            >
              <Sidebar size={12} />
              Exit focus
            </button>
          )}

          <div
            className="mx-auto min-h-full bg-white"
            style={{
              maxWidth: document.type === "pdf" ? undefined : `${800 * zoom}px`,
              padding: document.type === "pdf" ? 24 : 48,
              fontFamily: document.type === "pdf" ? undefined : "'Lora', Georgia, serif",
              fontSize: document.type === "pdf" ? undefined : `${15 * zoom}px`,
              lineHeight: document.type === "pdf" ? undefined : 1.75,
              color: document.type === "pdf" ? undefined : "#1A1A1A",
              display: "flex",
              justifyContent: "center",
            }}
          >
            {/* ── PDF canvas rendering ── */}
            {document.type === "pdf" ? (
              pdfRenderError ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-medium" style={{ color: "#F44336" }}>PDF rendering failed</p>
                  <p className="mt-2 text-xs opacity-50">{pdfRenderError}</p>
                </div>
              ) : !pdfDoc ? (
                <p className="py-12 text-center text-sm opacity-30">Loading PDF...</p>
              ) : (
                <canvas ref={pdfCanvasRef} className="shadow-md" style={{ maxWidth: "100%", height: "auto" }} />
              )
            ) : docContent ? (
              (document.type === "docx" || docContent.trim().startsWith("<")) ? (
                <div dangerouslySetInnerHTML={{ __html: docContent }} />
              ) : (
                (() => {
                  const lines = docContent.split("\n");
                  const snippet = highlightSnippet;
                  if (!snippet) return lines.map((line, i) => <p key={i} className="mb-1">{line || " "}</p>);
                  // Highlight the snippet across lines
                  return lines.map((line, i) => {
                    const idx = line.toLowerCase().indexOf(snippet.toLowerCase().slice(0, 30));
                    if (idx >= 0) {
                      const matchLen = Math.min(snippet.length, line.length - idx);
                      return (
                        <p key={i} className="mb-1">
                          {line.slice(0, idx)}
                          <mark data-highlight="true" style={{ backgroundColor: "var(--peach)", color: "#fff", padding: "2px 6px", borderRadius: 4, transition: "background-color 0.3s" }}>
                            {line.slice(idx, idx + matchLen)}
                          </mark>
                          {line.slice(idx + matchLen)}
                        </p>
                      );
                    }
                    return <p key={i} className="mb-1">{line || " "}</p>;
                  });
                })()
              )
            ) : (
              <p className="opacity-20 italic">Loading content...</p>
            )}
          </div>

          {/* Segment resize handles (when a citation is selected) */}
          {selectedSegment && (
            <SegmentResizeHandles
              top={80} bottom={120}
              onDragTop={() => {}}
              onDragBottom={() => {}}
            />
          )}
        </div>

        {/* ── Citation margin ── */}
        <CitationMargin
          segments={demoSegments}
          mode={marginMode}
          width={marginWidth}
          onSegmentClick={(id) => {
            setSelectedSegment(id === selectedSegment ? null : id);
            const seg = demoSegments.find((s) => s.id === id);
            if (seg) {
              setInspectedSegment({
                id, text: `Coded segment: ${seg.codeName}`, docName: document.name,
                authorName: seg.coderName ?? "You", authorColor: seg.coderColor ?? seg.color,
              });
            }
          }}
        />
      </div>

      {/* ── Floating selection panel ── */}
      {selection && (
        <SelectionPanel
          x={selection.x}
          y={selection.y}
          selectedText={selection.text}
          onClose={() => setSelection(null)}
          onAction={(action) => {
            switch (action) {
              case "code":
                setShowCategorySelector(true);
                return; // don't close panel yet — selector will handle close
              case "invivo": {
                const name = selection.text.slice(0, 80).trim();
                if (name) {
                  const color = `#${Math.floor(0 * 0xffffff).toString(16).padStart(6, "0")}`;
                  addCategory({ id: `iv-${Date.now()}`, name, color, parentId: null, count: 1, es_in_vivo: true });
                  toast.success("In vivo created", `"${name}"`);
                }
                break;
              }
              case "bookmark":
                toggleKeyEvidence(`${document.id}-${selection.text.slice(0, 20)}`);
                toast.success("Marked", "Segment bookmarked — use Filter → Key evidence to find it");
                break;
              case "paraphrase":
                toast.info("Paraphrase", "Write a paraphrase for this segment in the right panel inspector");
                break;
              case "comment":
                setCommentText("");
                setShowCommentModal(true);
                return; // don't close panel yet
              case "link":
                toast.info("Link", "Link this segment to another — select a target segment first");
                break;
              case "listen":
                if ("speechSynthesis" in window) {
                  const u = new SpeechSynthesisUtterance(selection.text);
                  u.lang = "es-ES";
                  window.speechSynthesis.speak(u);
                  toast.info("Reading aloud", "Press Escape to stop");
                }
                break;
            }
            setSelection(null);
          }}
        />
      )}

      {/* ── Category selector (sliding panel) ── */}
      <CategorySelector
        open={showCategorySelector}
        selectedText={selection?.text ?? ""}
        onClose={() => setShowCategorySelector(false)}
        onApply={(categoryId, weight) => {
          const cat = useProjectStore.getState().categories.find((c) => c.id === categoryId);
          if (cat) updateCategory(categoryId, { count: cat.count + 1 });
          pushRecent(categoryId);
          toast.success("Coded", `Applied "${cat?.name ?? "category"}" (weight: ${weight})`);
          setShowCategorySelector(false);
          setSelection(null);
        }}
      />

      {/* ── Comment modal ── */}
      {showCommentModal && selection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCommentModal(false)}>
          <div className="w-full max-w-sm rounded-xl p-5 shadow-xl" style={{ backgroundColor: "var(--bg-panel)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Add comment</h3>
            <div className="mb-2 max-h-16 overflow-y-auto rounded border p-2 text-xs italic opacity-50"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
              &ldquo;{selection.text.slice(0, 120)}{selection.text.length > 120 ? "..." : ""}&rdquo;
            </div>
            <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write your comment..." rows={3} autoFocus
              className="mb-3 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowCommentModal(false); setSelection(null); }}
                className="rounded-md border px-3 py-1.5 text-xs min-touch"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              <button onClick={() => {
                if (commentText.trim() && selection) {
                  const segId = `${document.id}-${selection.text.slice(0, 20)}`;
                  addSegmentComment(segId, commentText.trim(), "You");
                  // Also create a Memo for this comment
                  addMemo({
                    id: `memo-${Date.now()}`,
                    title: `Comment on "${selection.text.slice(0, 50)}${selection.text.length > 50 ? "..." : ""}"`,
                    content: commentText.trim(),
                    linkedDocIds: [document.id],
                    linkedCodeIds: [JSON.stringify({ type: "text", docId: document.id, snippet: selection.text.slice(0, 200) })],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                  toast.success("Comment saved", "View in Inspector → Comments or Memos tab");
                }
                setShowCommentModal(false);
                setSelection(null);
              }} disabled={!commentText.trim()}
                className="rounded-md bg-peach-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-peach-700 disabled:opacity-40 min-touch">
                Save comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast sutil — esquina inferior izquierda, 3 segundos */}
      {posRestoredToast && (
        <div className="fixed bottom-4 left-4 z-50 animate-slide-up rounded-lg px-4 py-2 text-xs font-medium shadow-lg pointer-events-none"
          style={{ backgroundColor: "var(--peach)", color: "#1a1a1a", opacity: 0.95 }}>
          {posRestoredToast}
        </div>
      )}
    </div>
  );
}

export default DocumentViewer;
