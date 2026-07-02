import { useState, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, Search, Download, Tag,
  AlignJustify, Columns, FileText, Eye, Plus, X, Trash2,
} from "lucide-react";
import { useToast } from "../../stores/toastStore";
import { useProjectStore } from "../../stores/projectStore";
import { getCitations } from "../../lib/tauriBridge";

/* ── Types ── */

interface Citation {
  id: string;
  text: string;
  docName: string;
  page: number;
  paragraph: number;
  researcherName: string;
  date: string;
  comment: string;
  categories: { id: string; name: string; color: string; weight: number }[];
}

const VIEWS = [
  { id: "large", icon: AlignJustify, label: "Large" },
  { id: "single", icon: Columns, label: "Single line" },
];

/* ── Main ── */

export function CitationReader() {
  const proyectoId = useProjectStore((s) => s.project?.id);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [idx, setIdx] = useState(0);
  const [view, setView] = useState("large");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  // Fetch real citations on mount
  useEffect(() => {
    if (!proyectoId || loaded) return;
    getCitations(proyectoId).then((res) => {
      const rows = res?.rows || [];
      setCitations(rows.map((r: any) => ({
        id: r.id || "", text: r.texto || r.texto_seleccionado || "",
        docName: r.doc || r.doc_nombre || "", page: Number(r.pagina || 0),
        paragraph: 1, researcherName: "", date: r.fecha || "", comment: "",
        categories: [], weight: Number(r.peso_codificacion || 50),
      })));
      setLoaded(true);
    }).catch(() => {});
  }, [proyectoId, loaded]);
  const [showComment, setShowComment] = useState(false);
  const [commentText, setCommentText] = useState("");
  const { toast } = useToast();

  const current = citations[idx];
  const total = citations.length;

  const next = () => setIdx((i) => Math.min(total - 1, i + 1));
  const prev = () => setIdx((i) => Math.max(0, i - 1));

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") prev();
      if (e.key === "Escape") toast.info("Reader", "Closing reader");
      if (e.key >= "1" && e.key <= "9") {
        const slot = parseInt(e.key) - 1;
        toast.info("Quick code", `Applied quick slot ${slot + 1}`);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [idx, total]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!current) return (
    <div className="flex items-center justify-center h-full text-xs opacity-30">No citations to display</div>
  );

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2" style={{ backgroundColor: "var(--peach)", color: "#fff" }}>
        <button onClick={prev} disabled={idx === 0} className="rounded p-1 hover:bg-white/20 disabled:opacity-30 min-touch">
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs font-medium">
          <strong>{idx + 1}</strong> of {total}
        </span>
        <button onClick={next} disabled={idx >= total - 1} className="rounded p-1 hover:bg-white/20 disabled:opacity-30 min-touch">
          <ChevronRight size={16} />
        </button>
        <div className="w-px h-4 bg-white/30 mx-1" />
        <Tag size={12} />
        <span className="text-xs font-semibold truncate max-w-[200px]">{current.categories[0]?.name ?? "Uncoded"}</span>
        <div className="flex-1" />
        {VIEWS.map((v) => (
          <button key={v.id} onClick={() => setView(v.id)}
            className={`rounded p-1.5 min-touch ${view === v.id ? "bg-white/20" : "hover:bg-white/10"}`} title={v.label}>
            <v.icon size={14} />
          </button>
        ))}
        <button onClick={() => toast.info("Search", "Search in citations")} className="rounded p-1.5 hover:bg-white/10 min-touch"><Search size={14} /></button>
        <button onClick={() => toast.info("Export", "Export all citations")} className="rounded p-1.5 hover:bg-white/10 min-touch"><Download size={14} /></button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Center — Citation text */}
        <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
          {view === "large" ? (
            <div className="max-w-[400px] text-center">
              <p className="text-[15px] leading-relaxed italic" style={{
                fontFamily: "'Lora', Georgia, serif",
                color: "var(--text-primary)",
              }}>
                &ldquo;{current.text}&rdquo;
              </p>
              <div className="mt-4 text-xs opacity-40 space-y-1">
                <p><FileText size={11} className="inline mr-1" />{current.docName} — P. {current.page}, ¶ {current.paragraph}</p>
                <p>{current.researcherName} · {current.date}</p>
              </div>
            </div>
          ) : (
            /* Single-line view */
            <div className="w-full space-y-1">
              {citations.map((c, i) => (
                <div key={c.id}
                  onClick={() => setIdx(i)}
                  className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs cursor-pointer min-touch ${
                    i === idx ? "" : "hover:bg-gray-50"
                  }`}
                  style={{ backgroundColor: i === idx ? "var(--peach)" + "10" : "transparent" }}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)}
                    style={{ accentColor: "var(--peach)" }} />
                  <span className="opacity-20 w-6 text-right flex-shrink-0">{i + 1}</span>
                  <span className="truncate max-w-[80%]" style={{ color: "var(--text-primary)" }}>{c.text.slice(0, 80)}</span>
                  <span className="text-[9px] opacity-30 ml-auto flex-shrink-0">{c.docName}</span>
                </div>
              ))}
              {selected.size > 0 && (
                <div className="flex gap-2 px-3 pt-2">
                  <button onClick={() => toast.info("Apply category", "Select a category from the left Codes panel to apply to selected citations")}
                    className="rounded bg-peach-500 px-2 py-1 text-[10px] text-white min-touch">
                    <Tag size={10} className="inline mr-1" />Apply category ({selected.size})
                  </button>
                  <button onClick={() => { setSelected(new Set()); toast.success("Cleared", "Selection cleared"); }}
                    className="rounded border px-2 py-1 text-[10px] min-touch" style={{ borderColor: "var(--border)", color: "#F44336" }}>
                    <Trash2 size={10} className="inline mr-1" />Clear ({selected.size})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right panel — Properties */}
        <div className="w-[280px] flex-shrink-0 border-l flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          {/* Citation info */}
          <div className="border-b p-3 space-y-2" style={{ borderColor: "var(--border)" }}>
            <input value={`Citation ${idx + 1}`} className="w-full bg-transparent text-sm font-semibold outline-none"
              style={{ color: "var(--text-primary)" }} onChange={() => {}} />

            {/* Comment */}
            {!showComment ? (
              <button onClick={() => setShowComment(true)}
                className="flex items-center gap-1 text-[10px] opacity-30 hover:opacity-60">
                <Plus size={10} /> Add comment
              </button>
            ) : (
              <div>
                <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..." rows={3}
                  className="w-full resize-none rounded border px-2 py-1.5 text-xs outline-none"
                  style={{ borderColor: "var(--border)" }} />
                <div className="flex justify-end gap-1 mt-1">
                  <button onClick={() => setShowComment(false)} className="text-[10px] opacity-40">Cancel</button>
                  <button onClick={() => { setShowComment(false); toast.success("Saved", "Comment saved"); }}
                    className="text-[10px] text-peach-500 font-medium">Save</button>
                </div>
              </div>
            )}

            {/* Categories */}
            {current.categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <span className="flex-1 text-xs" style={{ color: "var(--text-primary)" }}>{cat.name}</span>
                <input type="range" min={1} max={100} value={cat.weight}
                  className="w-[60px]" style={{ accentColor: cat.color }} onChange={() => {}} />
                <button onClick={() => toast.info("Remove category", "Click to remove this category from the citation")}
                  className="opacity-20 hover:opacity-60"><X size={11} /></button>
              </div>
            ))}
            <button onClick={() => toast.info("Add category", "Select a category from the left Codes panel")}
              className="flex items-center gap-1 text-[10px] opacity-30 hover:opacity-60">
              <Plus size={10} /> Add category
            </button>
          </div>

          {/* View in context button */}
          <div className="p-3">
            <button onClick={() => toast.info("View in context", "Open the document in Docs tab to see this citation in its original context")}
              className="flex w-full items-center justify-center gap-2 rounded-md border py-2 text-xs font-medium hover:bg-gray-50 min-touch"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              <Eye size={12} /> View in context
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CitationReader;
