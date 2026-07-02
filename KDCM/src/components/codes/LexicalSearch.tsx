import { useState, useCallback, useEffect, useRef } from "react";
import { Search, X, Regex as RegexIcon, WholeWord, CaseSensitive, Hash } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useFilterStore } from "../../stores/filterStore";
import { execQuery } from "../../lib/tauriBridge";

interface SearchResult { word: string; freq: number; docCount: number; segCount: number; contexts: { left: string; center: string; right: string; doc: string }[]; }

export function LexicalSearch() {
  const documents = useProjectStore((s) => s.documents);
  const categories = useProjectStore((s) => s.categories);
  const [query, setQuery] = useState("");
  const [regex, setRegex] = useState(false);
  const [fuzzy, setFuzzy] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [selectedWord, setSelectedWord] = useState<SearchResult | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [docFilter, setDocFilter] = useState("all");
  const [invFilter, setInvFilter] = useState("all");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const [results, setResults] = useState<SearchResult[]>([]);
  const proyectoId = useProjectStore((s) => s.project?.id);
  const filtroDoc = useFilterStore((s) => s.filtroDocumento);
  const filtroInv = useFilterStore((s) => s.filtroInvestigador);

  const handleSearch = useCallback(async () => {
    if (!debouncedQuery.trim() || !proyectoId) return;
    try {
      let sql = "SELECT ci.texto_seleccionado, d.nombre as doc FROM citas ci JOIN documentos d ON ci.documento_id=d.id WHERE d.proyecto_id=?1 AND ci.texto_seleccionado LIKE ?2";
      const params: any[] = [proyectoId, `%${debouncedQuery}%`];
      if (filtroDoc.length > 0) {
        sql += ` AND d.id IN (${filtroDoc.map(() => "?").join(",")})`;
        params.push(...filtroDoc);
      }
      if (filtroInv) { sql += " AND ci.investigador_id = ?" + (params.length + 1); params.push(filtroInv); }
      sql += " LIMIT 100";
      const r = await execQuery(sql, params);
      if (r && r.rows && r.rows.length > 0) {
        const wordMap = new Map<string, { freq: number; docs: Set<string>; contexts: { left: string; center: string; right: string; doc: string }[] }>();
        r.rows.forEach((row: any) => {
          const texto = row.texto_seleccionado || row[0] || "";
          const doc = row.doc || row.nombre || row[1] || "";
          const regex = new RegExp(`(.[\\s\\S]{0,30})(${debouncedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(.[\\s\\S]{0,30})`, caseSensitive ? 'g' : 'gi');
          let m;
          while ((m = regex.exec(texto)) !== null) {
            const word = m[2];
            if (!wordMap.has(word)) wordMap.set(word, { freq: 0, docs: new Set(), contexts: [] });
            const entry = wordMap.get(word)!;
            entry.freq++;
            entry.docs.add(doc);
            if (entry.contexts.length < 5) entry.contexts.push({ left: (m[1] || "").slice(-30), center: word, right: (m[3] || "").slice(0, 30), doc });
          }
        });
        setResults(Array.from(wordMap.entries()).map(([word, data]) => ({ word, freq: data.freq, docCount: data.docs.size, segCount: data.freq, contexts: data.contexts })));
      } else setResults([]);
    } catch { setResults([]); }
  }, [debouncedQuery, proyectoId, caseSensitive]);

  useEffect(() => { if (debouncedQuery.trim()) handleSearch(); }, [debouncedQuery]);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search bar */}
        <div className="border-b p-3" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 flex-1 rounded-md border px-3 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)" }}>
              <Search size={14} opacity={0.3} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search in segments..."
                className="flex-1 bg-transparent text-xs outline-none" style={{ color: "var(--text-primary)" }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }} />
              {query && <button onClick={() => { setQuery(""); setSelectedWord(null); }} className="rounded p-0.5 hover:bg-gray-100"><X size={13} /></button>}
            </div>
            <button onClick={handleSearch} className="rounded-md bg-peach-500 px-3 py-2 text-xs font-medium text-white hover:bg-peach-700 min-touch">Search</button>
          </div>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <label className="flex items-center gap-1 text-[10px] cursor-pointer" style={{ color: "var(--text-secondary)" }}><input type="checkbox" checked={regex} onChange={() => setRegex(!regex)} className="size-3" /> <RegexIcon size={11} /> Regex</label>
            <label className="flex items-center gap-1 text-[10px] cursor-pointer" style={{ color: "var(--text-secondary)" }}><input type="checkbox" checked={fuzzy} onChange={() => setFuzzy(!fuzzy)} className="size-3" /> Fuzzy</label>
            <label className="flex items-center gap-1 text-[10px] cursor-pointer" style={{ color: "var(--text-secondary)" }}><input type="checkbox" checked={caseSensitive} onChange={() => setCaseSensitive(!caseSensitive)} className="size-3" /> <CaseSensitive size={11} /> Aa</label>
            <label className="flex items-center gap-1 text-[10px] cursor-pointer" style={{ color: "var(--text-secondary)" }}><input type="checkbox" checked={wholeWord} onChange={() => setWholeWord(!wholeWord)} className="size-3" /> <WholeWord size={11} /> Word</label>
            <div className="flex-1"/>
            <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className="rounded border px-1.5 py-1 text-[9px] outline-none" style={{borderColor:"var(--border)",color:"var(--text-secondary)"}}><option value="all">All categories</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name.slice(0,20)}</option>)}</select>
            <select value={docFilter} onChange={e=>setDocFilter(e.target.value)} className="rounded border px-1.5 py-1 text-[9px] outline-none" style={{borderColor:"var(--border)",color:"var(--text-secondary)"}}><option value="all">All documents</option>{documents.map(d=><option key={d.id} value={d.id}>{d.name.slice(0,20)}</option>)}</select>
            <select value={invFilter} onChange={e=>setInvFilter(e.target.value)} className="rounded border px-1.5 py-1 text-[9px] outline-none" style={{borderColor:"var(--border)",color:"var(--text-secondary)"}}><option value="all">All researchers</option></select>
          </div>
        </div>
        {/* Results table */}
        <div className="flex-1 overflow-auto">
          {!query.trim() ? (
            <div className="flex h-full items-center justify-center"><p className="text-xs opacity-20">Enter a search term to find word frequencies</p></div>
          ) : results.length === 0 ? (
            <div className="flex h-full items-center justify-center"><p className="text-xs opacity-20">No results found</p></div>
          ) : (
            <table className="w-full text-xs">
              <thead><tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--text-secondary)" }}>Word</th>
                <th className="px-3 py-2 text-right font-medium" style={{ color: "var(--text-secondary)" }}><Hash size={11} className="inline" /> Freq</th>
                <th className="px-3 py-2 text-right font-medium" style={{ color: "var(--text-secondary)" }}>Docs</th>
                <th className="px-3 py-2 text-right font-medium" style={{ color: "var(--text-secondary)" }}>Segs</th>
                <th className="px-3 py-2 text-left font-medium" style={{ color: "var(--text-secondary)", width: 80 }}>Distribution</th>
              </tr></thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} onClick={() => setSelectedWord(r)}
                    className="border-b cursor-pointer hover:bg-gray-50 transition-colors"
                    style={{ borderColor: "var(--border)", backgroundColor: selectedWord?.word === r.word ? "var(--peach)" + "10" : "transparent" }}>
                    <td className="px-3 py-1.5 font-medium"><span style={{backgroundColor:"#FFEE8A",color:"var(--text-primary)",padding:"0 2px",borderRadius:2}}>{r.word}</span></td>
                    <td className="px-3 py-1.5 text-right" style={{ color: "var(--text-secondary)" }}>{r.freq}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: "var(--text-secondary)" }}>{r.docCount}</td>
                    <td className="px-3 py-1.5 text-right" style={{ color: "var(--text-secondary)" }}>{r.segCount}</td>
                    <td className="px-3 py-1.5"><div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden"><div className="h-full rounded-full" style={{width:Math.min(100,(r.freq/(r.freq+10))*100)+"%",backgroundColor:"var(--peach)",opacity:0.5}}/></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {/* KWIC panel */}
      <div className="w-[320px] flex-shrink-0 border-l flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <div className="border-b px-3 py-2 text-[10px] font-semibold uppercase opacity-30" style={{ borderColor: "var(--border)" }}>KWIC · Key Word in Context</div>
        <div className="flex-1 overflow-y-auto p-2">
          {selectedWord ? (
            <div className="space-y-2">
              {selectedWord.contexts.map((ctx, i) => (
                <div key={i} className="rounded border p-2 text-[10px] leading-relaxed" style={{ borderColor: "var(--border)" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{ctx.left} </span>
                  <span className="font-bold rounded-sm px-0.5" style={{ backgroundColor: "#FFEE8A", color: "#000" }}>{ctx.center}</span>
                  <span style={{ color: "var(--text-secondary)" }}> {ctx.right}</span>
                  <div className="mt-1 text-[9px] opacity-30">{ctx.doc}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] opacity-20 text-center pt-6">Click a word to see context</p>
          )}
        </div>
      </div>
    </div>
  );
}
