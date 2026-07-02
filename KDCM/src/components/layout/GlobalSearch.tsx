import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, FileText, Tag, MessageSquare, StickyNote, Clock } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useLayoutStore } from "../../stores/layoutStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  type: "doc" | "category" | "citation" | "memo";
  title: string;
  snippet: string;
  matchIndex: number;
  parent?: string;
}

const HISTORY_KEY = "kdcm-search-history";
const MAX_HISTORY = 10;

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); } catch { return []; }
}
function saveHistory(term: string) {
  const prev = loadHistory().filter((h) => h !== term);
  const next = [term, ...prev].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* */ }
}

export function GlobalSearch({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [history, setHistory] = useState<string[]>(loadHistory());
  const [filters, setFilters] = useState({ docs: true, categories: true, citations: true, memos: true });
  const [useRegex, setUseRegex] = useState(false);
  const [useFuzzy, setUseFuzzy] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const documents = useProjectStore((s) => s.documents);
  const categories = useProjectStore((s) => s.categories);
  const memos = useProjectStore((s) => s.memos);
  const setSelectedDocId = useLayoutStore((s) => s.setSelectedDocId);

  // Autofocus
  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 50); setQuery(""); setResults([]); }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const q = query.toLowerCase().trim();
      const items: SearchResult[] = [];

      const match = (text: string, term: string): number => {
        if (useRegex) {
          try { const re = new RegExp(term, "i"); const m = text.match(re); return m?.index ?? -1; }
          catch { return -1; }
        }
        if (useFuzzy) {
          // Simple fuzzy: check if characters appear in order with max 2 gaps
          let ti = 0, gaps = 0;
          for (let i = 0; i < text.length && ti < term.length; i++) {
            if (text[i] === term[ti]) { ti++; gaps = 0; }
            else { gaps++; if (gaps > 2) return -1; }
          }
          return ti === term.length ? text.indexOf(term[0]) : -1;
        }
        return text.indexOf(term);
      };

      // Search documents
      if (filters.docs) {
        documents.forEach((d) => {
          const idx = match(d.name.toLowerCase(), q);
          if (idx >= 0) items.push({ id: d.id, type: "doc", title: d.name, snippet: `Type: ${d.type} · ${(d.size / 1024).toFixed(1)} KB`, matchIndex: idx });
        });
      }

      // Search categories
      if (filters.categories) {
        categories.forEach((c) => {
          const idx = match(c.name.toLowerCase(), q);
          if (idx >= 0) items.push({ id: c.id, type: "category", title: c.name, snippet: `${c.count} segments · ${c.description ?? ""}`, matchIndex: idx });
        });
      }

      // Search memos
      if (filters.memos) {
        memos.forEach((m) => {
          const ti = match(m.title.toLowerCase(), q);
          const ci = match(m.content.toLowerCase(), q);
          if (ti >= 0 || ci >= 0) {
            items.push({ id: m.id, type: "memo", title: m.title, snippet: m.content.slice(0, 120), matchIndex: Math.max(ti, ci) });
          }
        });
      }

      // Real citations from SQLite (via execQuery)
      if (filters.citations) {
        try {
          const pid = useProjectStore.getState().project?.id;
          if (pid) {
            const { execQuery } = await import("../../lib/tauriBridge");
            const citResult = await execQuery(
              "SELECT c.id, c.texto_seleccionado, d.nombre as doc FROM citas c JOIN documentos d ON c.documento_id=d.id WHERE d.proyecto_id=?1 AND c.texto_seleccionado LIKE ?2 LIMIT 30",
              [pid, `%${q}%`]
            );
            (citResult.rows || []).forEach((c: any) => {
              const idx = match((c.texto_seleccionado || "").toLowerCase(), q);
              if (idx >= 0) items.push({ id: c.id, type: "citation", title: (c.texto_seleccionado || "").slice(0, 60) + "...", snippet: c.texto_seleccionado || "", matchIndex: idx, parent: c.doc });
            });
          }
        } catch {}
      }

      setResults(items);
      setSelectedIdx(0);
      setLoading(false);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, filters, useRegex, useFuzzy, documents, categories, memos]);

  const handleSelect = useCallback((item: SearchResult, ctrl: boolean) => {
    saveHistory(query.trim());
    setHistory(loadHistory());
    if (item.type === "doc") setSelectedDocId(item.id);
    if (!ctrl) onClose();
  }, [query, onClose, setSelectedDocId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(results.length - 1, i + 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(0, i - 1)); }
    if (e.key === "Enter" && results[selectedIdx]) {
      handleSelect(results[selectedIdx], e.ctrlKey || e.metaKey);
    }
  };

  // Group results by type
  const grouped: Record<string, SearchResult[]> = {};
  results.forEach((r) => { (grouped[r.type] ??= []).push(r); });
  const typeLabels: Record<string, { label: string; icon: React.ComponentType<{ size?: number }> }> = {
    doc: { label: "Documents", icon: FileText },
    category: { label: "Categories", icon: Tag },
    citation: { label: "Citations", icon: MessageSquare },
    memo: { label: "Memos", icon: StickyNote },
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-start justify-center pt-[15vh] bg-black/40" onClick={onClose}>
      <div className="w-full max-w-[600px] rounded-xl shadow-2xl" style={{ backgroundColor: "var(--bg-panel)" }}
        onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        {/* Input */}
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <Search size={18} opacity={0.4} />
          <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all documents, categories, memos..."
            className="flex-1 bg-transparent text-sm outline-none" style={{ color: "var(--text-primary)" }} />
          {loading && <span className="text-[10px] opacity-30">...</span>}
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "var(--border)" }}>
          {(["docs","categories","citations","memos"] as const).map((f) => (
            <button key={f} onClick={() => setFilters((prev) => ({ ...prev, [f]: !prev[f] }))}
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium min-touch capitalize ${
                filters[f] ? "bg-peach-500 text-white" : "hover:bg-gray-100"
              }`} style={{ color: filters[f] ? "#fff" : "var(--text-secondary)" }}>
              {f}
            </button>
          ))}
          <div className="flex-1" />
          <label className="flex items-center gap-1 text-[10px] cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} style={{ accentColor: "var(--peach)" }} /> Regex
          </label>
          <label className="flex items-center gap-1 text-[10px] cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={useFuzzy} onChange={(e) => setUseFuzzy(e.target.checked)} style={{ accentColor: "var(--peach)" }} /> Fuzzy
          </label>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {!query.trim() && history.length > 0 && (
            <div className="px-4 py-3">
              <p className="mb-2 text-[10px] font-semibold opacity-30 flex items-center gap-1"><Clock size={11} /> Recent searches</p>
              <div className="flex flex-wrap gap-1.5">
                {history.map((h, i) => (
                  <button key={i} onClick={() => setQuery(h)}
                    className="rounded-full border px-2.5 py-0.5 text-[10px] hover:bg-gray-100 min-touch"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>{h}</button>
                ))}
              </div>
            </div>
          )}

          {query.trim() && results.length === 0 && !loading && (
            <div className="px-4 py-8 text-center text-xs opacity-30">No results found for "{query}"</div>
          )}

          {Object.entries(grouped).map(([type, items]) => {
            const cfg = typeLabels[type];
            if (!cfg) return null;
            const Icon = cfg.icon;
            return (
              <div key={type}>
                <div className="sticky top-0 px-4 py-1.5 text-[10px] font-semibold uppercase opacity-30 flex items-center gap-1.5"
                  style={{ backgroundColor: "var(--bg-panel)" }}>
                  <Icon size={11} /> {cfg.label} ({items.length})
                </div>
                {items.map((item) => {
                  const globalIdx = results.indexOf(item);
                  const isSelected = globalIdx === selectedIdx;
                  return (
                    <button key={item.id}
                      onClick={(e) => handleSelect(item, e.ctrlKey || e.metaKey)}
                      className={`w-full px-4 py-2 text-left transition-colors ${
                        isSelected ? "" : "hover:bg-gray-50"
                      }`}
                      style={{ backgroundColor: isSelected ? "var(--bg-secondary)" : "transparent" }}>
                      <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                        {item.matchIndex >= 0 ? (
                          <>
                            {item.title.slice(0, item.matchIndex)}
                            <mark style={{ backgroundColor: "#FFEE8A", padding: "0 2px", borderRadius: 2 }}>{item.title.slice(item.matchIndex, item.matchIndex + query.trim().length)}</mark>
                            {item.title.slice(item.matchIndex + query.trim().length)}
                          </>
                        ) : item.title}
                      </p>
                      <p className="mt-0.5 text-[10px] opacity-40 truncate">
                        {item.snippet}
                        {item.parent && <span className="ml-2 opacity-60">in {item.parent}</span>}
                      </p>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t px-4 py-2 text-[10px] opacity-30" style={{ borderColor: "var(--border)" }}>
          <span>↑↓ navigate</span><span>Enter open</span><span>Ctrl+Enter open without closing</span><span>Esc close</span>
        </div>
      </div>
    </div>
  );
}

export default GlobalSearch;
