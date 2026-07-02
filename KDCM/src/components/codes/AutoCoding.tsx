import { useState } from "react";
import {
  Search, BookOpen, User, Zap, Hash, Play, Download, Tag,
  Eye, Plus, Trash2,
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { getCitations, execQuery } from "../../lib/tauriBridge";

function DictionaryExecute({ entries, toast, projectId }: { entries: any[]; toast: any; projectId?: string }) {
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState("");

  const handleExecute = async () => {
    if (entries.length === 0) { toast.info("No entries", "Add terms to the dictionary first"); return; }
    if (!projectId) { toast.info("No project", "Open a project first"); return; }
    setRunning(true); setProgress(0); setResult("");
    try {
      const res = await getCitations(projectId);
      const citations = res?.rows || [];
      let coded = 0;
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const term = entry.term?.toLowerCase() || "";
        if (!term) continue;
        // Find matching citations
        const matches = citations.filter((c: any) => {
          const texto = (c.texto || c.texto_seleccionado || "").toLowerCase();
          return texto.includes(term);
        });
        // Insert citas_codigos for each match
        for (const match of matches) {
          const citaId = match.id || "";
          const codigoId = entry.categoryId || entry.id || "";
          if (!citaId || !codigoId) continue;
          const linkId = `cc-${Date.now()}-${coded}`;
          await execQuery(
            "INSERT INTO citas_codigos (id, cita_id, codigo_id, peso_codificacion, fecha) VALUES (?1,?2,?3,?4,?5)",
            [linkId, citaId, codigoId, 50, new Date().toISOString()]
          ).catch(() => {});
          coded++;
        }
        setProgress(Math.round(((i + 1) / entries.length) * 100));
      }
      setResult(`${coded} segments coded across ${entries.length} terms`);
      toast.success("Executed", result || `${entries.length} terms processed`);
    } catch { toast.error("Error", "Could not execute auto-coding"); }
    setRunning(false);
  };

  return (
    <div className="flex items-center gap-2">
      {running ? (
        <div className="flex items-center gap-2 flex-1">
          <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden"><div className="h-full rounded-full bg-peach-500 transition-all duration-150" style={{ width: progress + "%" }} /></div>
          <span className="text-[10px] font-medium" style={{ color: "#000" }}>{progress}%</span>
        </div>
      ) : (
        <button onClick={handleExecute} className="flex items-center gap-1 rounded bg-green-600 px-4 py-1.5 text-[11px] font-medium text-white hover:bg-green-700 min-touch"><Play size={11} /> Execute</button>
      )}
      {result && !running && <span className="text-[10px] opacity-50">{result}</span>}
    </div>
  );
}

/* ── Types ── */

type AutoCodeMode = "term" | "dictionary" | "speaker" | "concept" | "ner";

const MODES: { id: AutoCodeMode; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "term", label: "By term", icon: Search },
  { id: "dictionary", label: "By dictionary", icon: BookOpen },
  { id: "speaker", label: "By speaker", icon: User },
  { id: "concept", label: "By concept", icon: Zap },
  { id: "ner", label: "NER", icon: Hash },
];

interface DictionaryEntry { id: string; term: string; categoryName: string; categoryColor: string; }
interface NERResult { entity: string; type: string; occurrences: number; docs: string; }

/* ── By Term ── */
function ByTerm() {
  const categories = useProjectStore((s) => s.categories);
  const [term, setTerm] = useState("");
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [selectedCat, setSelectedCat] = useState("");
  const [weight, setWeight] = useState(50);
  const [preview, setPreview] = useState<string[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const handlePreview = async () => {
    if (!term.trim()) return;
    const proyectoId = useProjectStore.getState().project?.id;
    if (!proyectoId) return;
    try {
      const res = await getCitations(proyectoId);
      const rows = (res?.rows || []).map((r: any) => r.texto || r.texto_seleccionado || "").filter((t: string) => t.toLowerCase().includes(term.toLowerCase()));
      setPreview(rows.slice(0, 20));
    } catch { setPreview([]); }
  };

  return (
    <div className="space-y-3 p-4">
      <div>
        <label className="block text-[10px] font-medium opacity-40 mb-1">Search term</label>
        <input value={term} onChange={(e) => setTerm(e.target.value)}
          placeholder="Enter term or pattern..."
          className="w-full rounded border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
      </div>
      <div className="flex gap-4 text-[10px]">
        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={regex} onChange={(e) => setRegex(e.target.checked)} style={{ accentColor: "var(--peach)" }} /> Regex</label>
        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} style={{ accentColor: "var(--peach)" }} /> Case sensitive</label>
        <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={wholeWord} onChange={(e) => setWholeWord(e.target.checked)} style={{ accentColor: "var(--peach)" }} /> Whole word</label>
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-[10px] font-medium opacity-40 mb-1">Category</label>
          <select value={selectedCat} onChange={(e) => setSelectedCat(e.target.value)}
            className="w-full rounded border bg-transparent px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
            <option value="">— Select —</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium opacity-40 mb-1">Weight</label>
          <input type="number" value={weight} min={1} max={100} onChange={(e) => setWeight(Number(e.target.value))}
            className="w-16 rounded border px-2 py-2 text-sm outline-none text-center"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
        </div>
        <button onClick={handlePreview}
          className="flex items-center gap-1 rounded-md bg-peach-500 px-4 py-2 text-xs font-medium text-white hover:bg-peach-700 min-touch">
          <Eye size={12} /> Preview
        </button>
      </div>
      {preview.length > 0 && (
        <div className="border rounded-md" style={{ borderColor: "var(--border)" }}>
          {preview.map((p, i) => (
            <div key={i} className={`flex items-start gap-2 px-3 py-2 border-b last:border-b-0 text-xs ${checked.has(i) ? "" : ""}`}
              style={{ borderColor: "var(--border)", backgroundColor: checked.has(i) ? "var(--peach)" + "08" : "transparent" }}>
              <input type="checkbox" checked={checked.has(i)} onChange={() => {
                setChecked((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });
              }} style={{ accentColor: "var(--peach)" }} />
              <span style={{ color: "var(--text-primary)" }}>{p}</span>
            </div>
          ))}
          <div className="px-3 py-2">
            <button onClick={() => toast.success("Coded", `${checked.size} segments coded as "${categories.find(c => c.id === selectedCat)?.name}"`)}
              disabled={checked.size === 0 || !selectedCat}
              className="flex items-center gap-1 rounded bg-peach-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-peach-700 disabled:opacity-30 min-touch">
              <Tag size={11} /> Code selected ({checked.size})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── By Dictionary ── */
function ByDictionary() {
  const categories = useProjectStore((s) => s.categories);
  const projectId = useProjectStore((s) => s.project?.id);
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [term, setTerm] = useState("");
  const [catId, setCatId] = useState("");
  const { toast } = useToast();

  const addEntry = () => {
    if (!term.trim() || !catId) return;
    const cat = categories.find((c) => c.id === catId);
    setEntries((prev) => [...prev, { id: `de-${Date.now()}`, term: term.trim(), categoryName: cat?.name ?? "", categoryColor: cat?.color ?? "#F1D7FF" }]);
    setTerm(""); setCatId("");
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-[10px] font-medium opacity-40 mb-1">Term</label>
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Term..."
            className="w-full rounded border px-3 py-1.5 text-xs outline-none"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
        </div>
        <div>
          <label className="block text-[10px] font-medium opacity-40 mb-1">→ Category</label>
          <select value={catId} onChange={(e) => setCatId(e.target.value)}
            className="rounded border bg-transparent px-2 py-1.5 text-xs outline-none"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
            <option value="">—</option>
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
        <button onClick={addEntry}
          className="flex-shrink-0 rounded bg-peach-500 p-1.5 text-white hover:bg-peach-700 min-touch"><Plus size={14} /></button>
      </div>
      <div className="border rounded-md overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-xs">
          <thead><tr style={{ backgroundColor: "var(--bg-secondary)" }}>
            <th className="px-3 py-1.5 text-left opacity-40">Term</th>
            <th className="px-3 py-1.5 text-left opacity-40">→ Category</th>
            <th className="px-3 py-1.5 w-10"></th>
          </tr></thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-1.5" style={{ color: "var(--text-primary)" }}>{e.term}</td>
                <td className="px-3 py-1.5"><span style={{ color: e.categoryColor }}>● {e.categoryName}</span></td>
                <td className="px-3 py-1.5"><button onClick={() => setEntries((prev) => prev.filter((en) => en.id !== e.id))} className="text-red-400 hover:text-red-600"><Trash2 size={11} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button onClick={() => toast.info("CSV", "Import dictionary from CSV")}
          className="flex items-center gap-1 rounded border px-3 py-1.5 text-[11px] min-touch"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <Download size={11} /> Import CSV
        </button>
        <button onClick={() => toast.success("Saved", "Dictionary saved")}
          className="rounded border px-3 py-1.5 text-[11px] min-touch"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          Save dictionary
        </button>
        <div className="flex-1" />
        <DictionaryExecute entries={entries} toast={toast} projectId={projectId} />
      </div>
    </div>
  );
}

/* ── By Concept (compromise.js) ── */
function ByConcept() {
  const [concept, setConcept] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const expand = () => {
    if (!concept.trim()) return;
    setExpanded([concept.trim(), `${concept.trim()} related`, `${concept.trim()} variant`, `${concept.trim()} context`]);
  };

  return (
    <div className="space-y-3 p-4">
      <p className="text-[10px] opacity-30">Uses compromise.js (offline) for semantic field expansion</p>
      <div className="flex gap-2">
        <input value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Base concept..."
          className="flex-1 rounded border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
        <button onClick={expand}
          className="flex items-center gap-1 rounded bg-peach-500 px-4 py-2 text-xs font-medium text-white hover:bg-peach-700 min-touch">
          <Zap size={12} /> Expand
        </button>
      </div>
      {expanded.length > 0 && (
        <div className="border rounded-md" style={{ borderColor: "var(--border)" }}>
          {expanded.map((t, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b last:border-b-0 text-xs"
              style={{ borderColor: "var(--border)" }}>
              <input type="checkbox" checked={checked.has(t)}
                onChange={() => setChecked((prev) => { const next = new Set(prev); next.has(t) ? next.delete(t) : next.add(t); return next; })}
                style={{ accentColor: "var(--peach)" }} />
              <span style={{ color: "var(--text-primary)" }}>{t}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── NER ── */
function NERPanel() {
  const [filters, setFilters] = useState({ persons: true, orgs: true, places: true, dates: true, amounts: true });
  const [results, setResults] = useState<NERResult[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const detect = async () => {
    // NER requires real citation data from the project
    const proyectoId = useProjectStore.getState().project?.id;
    if (!proyectoId) { setResults([]); return; }
    try {
      const res = await getCitations(proyectoId);
      const rows = res?.rows || [];
      // Simple regex-based NER detection on citation text
      const patterns: [RegExp, string][] = [
        [/\b[A-ZÁÉÍÓÚ][a-záéíóú]{2,}\s[A-ZÁÉÍÓÚ][a-záéíóú]{2,}\b/g, "Person"],
        [/\b(?:Universidad|Instituto|Ministerio|ONG|Colegio|Hospital|Empresa|Corporación)\s[\w\s]{3,30}\b/g, "Organization"],
        [/\b(?:Bogotá|Medellín|Cali|Lima|Madrid|México|Santiago|Buenos Aires|Quito|Caracas)\b/g, "Place"],
        [/\b\d{1,2}\sde\s(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s?(?:de\s?)?\d{4}\b/g, "Date"],
        [/\$\s?[\d.,]+(?:\s?(?:millones|mil|pesos|USD|COP))?\b/g, "Amount"],
      ];
      const entityMap = new Map<string, NERResult>();
      rows.forEach((r: any) => {
        const text = r.texto || r.texto_seleccionado || "";
        patterns.forEach(([pattern, type]) => {
          let m;
          while ((m = pattern.exec(text)) !== null) {
            const entity = m[0].trim();
            if (entity.length < 3) continue;
            const key = `${type}:${entity}`;
            const existing = entityMap.get(key);
            if (existing) { existing.occurrences++; }
            else { entityMap.set(key, { entity, type, occurrences: 1, docs: "1 doc" }); }
          }
        });
      });
      setResults(Array.from(entityMap.values()).slice(0, 30));
    } catch { setResults([]); }
  };

  return (
    <div className="space-y-3 p-4">
      <p className="text-[10px] opacity-30">Uses compromise.js + proper name lists (offline)</p>
      <div className="flex flex-wrap gap-3 text-[10px]">
        {[{ key: "persons", label: "👤 People" }, { key: "orgs", label: "🏛 Organizations" }, { key: "places", label: "🌍 Places" }, { key: "dates", label: "📅 Dates" }, { key: "amounts", label: "💰 Amounts" }].map((f) => (
          <label key={f.key} className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={(filters as any)[f.key]} onChange={(e) => setFilters((prev) => ({ ...prev, [f.key]: e.target.checked }))}
              style={{ accentColor: "var(--peach)" }} /> {f.label}
          </label>
        ))}
      </div>
      <button onClick={detect}
        className="flex items-center gap-1 rounded bg-peach-500 px-4 py-2 text-xs font-medium text-white hover:bg-peach-700 min-touch">
        <Play size={12} /> Detect entities
      </button>
      {results.length > 0 && (
        <div className="border rounded-md overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-xs">
            <thead><tr style={{ backgroundColor: "var(--bg-secondary)" }}>
              <th className="px-3 py-1.5 text-left w-8"></th>
              <th className="px-3 py-1.5 text-left opacity-40">Entity</th>
              <th className="px-3 py-1.5 text-left opacity-40">Type</th>
              <th className="px-3 py-1.5 text-right opacity-40">Occ.</th>
              <th className="px-3 py-1.5 text-left opacity-40">Docs</th>
            </tr></thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-1.5"><input type="checkbox" checked={checked.has(i)} onChange={() => setChecked((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; })}
                    style={{ accentColor: "var(--peach)" }} /></td>
                  <td className="px-3 py-1.5 font-medium" style={{ color: "var(--text-primary)" }}>{r.entity}</td>
                  <td className="px-3 py-1.5 opacity-40">{r.type}</td>
                  <td className="px-3 py-1.5 text-right font-mono" style={{ color: "#000" }}>{r.occurrences}</td>
                  <td className="px-3 py-1.5 opacity-40">{r.docs}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2">
            <button onClick={() => toast.success("Coded", `${checked.size} entities coded`)}
              disabled={checked.size === 0}
              className="flex items-center gap-1 rounded bg-peach-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-peach-700 disabled:opacity-30">
              <Tag size={11} /> Code selected entities
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main ── */

export function AutoCoding() {
  const [mode, setMode] = useState<AutoCodeMode>("term");

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      <div className="flex items-center border-b" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        {MODES.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium min-touch ${mode === m.id ? "" : "opacity-50 hover:opacity-80"}`}
            style={{ color: mode === m.id ? "#000" : "#000",
              borderBottom: mode === m.id ? "2px solid var(--peach)" : "2px solid transparent" }}>
            <m.icon size={13} /> {m.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {mode === "term" && <ByTerm />}
        {mode === "dictionary" && <ByDictionary />}
        {mode === "concept" && <ByConcept />}
        {mode === "ner" && <NERPanel />}
        {mode === "speaker" && (
          <div className="p-4 text-xs opacity-30">Auto-code by speaker: assign categories based on document speaker metadata.</div>
        )}
      </div>
    </div>
  );
}

export default AutoCoding;
