import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, FileText, Tag, Quote, StickyNote } from "lucide-react";
import { execQuery } from "../../lib/tauriBridge";
import Fuse from "fuse.js";

interface SearchResult { id: string; title: string; type: "doc" | "code" | "citation" | "memo"; subtitle?: string; }

interface Props {
  projectId: string;
  onNavigate: (type: string, id: string) => void;
}

/** Levenshtein distance for fuzzy matching fallback (max distance 2) */
function levenshtein(a: string, b: string): number {
  const al = a.length, bl = b.length;
  if (al === 0) return bl; if (bl === 0) return al;
  const dp: number[][] = Array.from({ length: al + 1 }, () => Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) dp[i][0] = i;
  for (let j = 0; j <= bl; j++) dp[0][j] = j;
  for (let i = 1; i <= al; i++) for (let j = 1; j <= bl; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[al][bl];
}

export function GlobalSearch({ projectId, onNavigate }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ docs: true, codes: true, citations: true, memos: true });
  const [useRegex, setUseRegex] = useState(false);
  const [useFuzzy, setUseFuzzy] = useState(false);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [investigadorFilter, setInvestigadorFilter] = useState("");
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("kdcm_search_history") || "[]"); } catch { return []; }
  });
  const inputRef = useRef<HTMLInputElement>(null);
  

  // Ctrl+Shift+F to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "F") { e.preventDefault(); setOpen(true); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const all: SearchResult[] = [];
    try {
      if (filters.docs && projectId) {
        let sql = "SELECT id, nombre FROM documentos WHERE nombre LIKE ?1 AND proyecto_id=?2";
        const params: any[] = [`%${q}%`, projectId];
        if (fechaDesde) { sql += " AND fecha_importacion >= ?3"; params.push(fechaDesde); }
        if (fechaHasta) { sql += " AND fecha_importacion <= ?" + (params.length + 1); params.push(fechaHasta); }
        const r = await execQuery(sql, params);
        (r?.rows || []).forEach((row: any) => all.push({ id: row.id || row[0], title: row.nombre || row[1], type: "doc" }));
      }
      if (filters.codes && projectId) {
        const r = await execQuery("SELECT id, nombre FROM codigos WHERE (nombre LIKE ?1 OR descripcion LIKE ?1) AND proyecto_id=?2", [`%${q}%`, projectId]);
        (r?.rows || []).forEach((row: any) => all.push({ id: row.id || row[0], title: row.nombre || row[1], type: "code" }));
      }
      if (filters.citations) {
        let sql2 = "SELECT id, texto_seleccionado FROM citas WHERE texto_seleccionado LIKE ?1";
        const params2: any[] = [`%${q}%`];
        if (fechaDesde) { sql2 += " AND fecha_creacion >= ?" + (params2.length + 1); params2.push(fechaDesde); }
        if (fechaHasta) { sql2 += " AND fecha_creacion <= ?" + (params2.length + 1); params2.push(fechaHasta); }
        if (investigadorFilter) { sql2 += " AND investigador_id = ?" + (params2.length + 1); params2.push(investigadorFilter); }
        sql2 += " LIMIT 50";
        const r = await execQuery(sql2, params2);
        (r?.rows || []).forEach((row: any) => all.push({ id: row.id || row[0], title: (row.texto_seleccionado || row[1] || "").slice(0, 80), type: "citation", subtitle: row.doc }));
      }
      if (filters.memos && projectId) {
        const r = await execQuery("SELECT id, titulo FROM memos WHERE (titulo LIKE ?1 OR contenido_html LIKE ?1) AND proyecto_id=?2", [`%${q}%`, projectId]);
        (r?.rows || []).forEach((row: any) => all.push({ id: row.id || row[0], title: row.titulo || row[1], type: "memo" }));
      }
    } catch { /* backend not available */ }
    // Apply fuzzy search if enabled
    let finalResults = all;
    if (useFuzzy && q.trim() && all.length > 0) {
      // First pass: fuse.js with threshold 0.4
      const fuse = new Fuse(all, { keys: ["title", "subtitle"], threshold: 0.4, distance: 100, minMatchCharLength: 2 });
      const fuseResults = fuse.search(q);
      if (fuseResults.length > 0) {
        finalResults = fuseResults.map((r) => r.item);
      } else {
        // Second pass: Levenshtein distance <= 2 as fallback (e.g. 'tecnologia' → 'tecnología')
        finalResults = all.filter((item) => {
          const words = item.title.toLowerCase().split(/\s+/);
          return words.some((w) => levenshtein(w, q.toLowerCase()) <= 2);
        });
      }
    }
    setResults(finalResults.slice(0, 50));
    setLoading(false);
  }, [filters, projectId, useFuzzy, fechaDesde, fechaHasta]);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  const handleSelect = (result: SearchResult, ctrlKey: boolean) => {
    // Save to history
    const newHistory = [query, ...history.filter((h) => h !== query)].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem("kdcm_search_history", JSON.stringify(newHistory));
    onNavigate(result.type, result.id);
    if (!ctrlKey) setOpen(false);
  };

  if (!open) return null;

  const grouped: Record<string, SearchResult[]> = {};
  results.forEach((r) => { if (!grouped[r.type]) grouped[r.type] = []; grouped[r.type].push(r); });

  const GROUP_ICONS: Record<string, any> = { doc: FileText, code: Tag, citation: Quote, memo: StickyNote };
  const GROUP_LABELS: Record<string, string> = { doc: "Documents", code: "Categories", citation: "Citations", memo: "Memos" };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="w-full max-w-[600px] rounded-xl shadow-xl" style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}>
        {/* Search input */}
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <Search size={16} style={{ color: "var(--text-secondary)" }} />
          <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en todo el proyecto..."
            className="flex-1 border-none bg-transparent text-sm outline-none" style={{ color: "var(--text-primary)" }} />
          <span className="text-[10px] opacity-30 mr-1">Esc</span>
          <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-gray-100" title="Cerrar (Esc)"><X size={14} /></button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 border-b px-4 py-2" style={{ borderColor: "var(--border)" }}>
          {Object.entries(filters).map(([key, val]) => {
            const Icon = GROUP_ICONS[key];
            return (
              <button key={key} onClick={() => setFilters((f) => ({ ...f, [key]: !val }))}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-all ${val ? "" : "opacity-40"}`}
                style={{ backgroundColor: val ? "var(--peach)" : "var(--bg-secondary)", color: val ? "#1a1a1a" : "var(--text-secondary)" }}>
                {Icon && <Icon size={10} />}{key}
              </button>
            );
          })}
          <div className="flex-1" />
          {/* Researcher filter */}
          <select value={investigadorFilter} onChange={(e) => setInvestigadorFilter(e.target.value)}
            className="rounded border px-1 py-0.5 text-[9px] outline-none" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <option value="">All researchers</option>
          </select>
          {/* Date range filters */}
          <span className="text-[9px] opacity-40">From:</span>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
            className="rounded border px-1 py-0.5 text-[9px] outline-none w-[110px]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }} />
          <span className="text-[9px] opacity-40">To:</span>
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
            className="rounded border px-1 py-0.5 text-[9px] outline-none w-[110px]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }} />
          <label className="flex items-center gap-1 text-[10px] cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} style={{ accentColor: "var(--peach)" }} />Regex
          </label>
          <label className="flex items-center gap-1 text-[10px] cursor-pointer" style={{ color: "var(--text-secondary)" }}>
            <input type="checkbox" checked={useFuzzy} onChange={(e) => setUseFuzzy(e.target.checked)} style={{ accentColor: "var(--peach)" }} />Fuzzy
          </label>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto p-2">
          {!query.trim() && history.length > 0 && (
            <div>
              <p className="px-2 py-1 text-[10px] font-medium opacity-30">Recent searches</p>
              {history.map((h, i) => (
                <button key={i} onClick={() => setQuery(h)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-gray-100" style={{ color: "var(--text-secondary)" }}>
                  <Search size={10} opacity={0.3} />{h}
                </button>
              ))}
            </div>
          )}
          {loading && <p className="px-2 py-4 text-center text-xs opacity-30">Searching...</p>}
          {!loading && query.trim() && results.length === 0 && (
            <p className="px-2 py-6 text-center text-xs opacity-30">No results found for "{query}"</p>
          )}
          {Object.entries(grouped).map(([type, items]) => {
            const Icon = GROUP_ICONS[type];
            return (
              <div key={type} className="mb-2">
                <p className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold opacity-40">
                  {Icon && <Icon size={11} />}{GROUP_LABELS[type] || type} ({items.length})
                </p>
                {items.map((item) => (
                  <button key={item.id} onClick={(e) => handleSelect(item, e.ctrlKey)}
                    className="flex w-full flex-col rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-gray-100"
                    style={{ color: "var(--text-primary)" }}>
                    <span className="font-medium line-clamp-1">{highlightMatch(item.title, query)}</span>
                    {item.subtitle && <span className="mt-0.5 text-[10px] opacity-40 truncate">{item.subtitle}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ backgroundColor: "#FFEE8A", color: "#1a1a1a" }}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function useGlobalSearch(projectId: string) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "F") { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return { open, setOpen, GlobalSearch: () => <GlobalSearch projectId={projectId} onNavigate={() => setOpen(false)} /> };
}

export default GlobalSearch;
