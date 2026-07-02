import { useState } from "react";
import { Download, Search, X, Loader2, Globe, AlertTriangle } from "lucide-react";
import { useProjectStore } from "../../../stores/projectStore";
import { useToast } from "../../../stores/toastStore";
import { saveDocumentWeb } from "../../../lib/tauriBridge";
import { Readability } from "@mozilla/readability";

interface Props { open: boolean; onClose: () => void; }
interface PageEntry { url: string; title: string; checked: boolean; blocked?: boolean; }

export function WebScraperImporter({ open, onClose }: Props) {
  const project = useProjectStore((s) => s.project);
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [depth, setDepth] = useState(1);
  const [limit, setLimit] = useState(10);
  const [excludePattern, setExcludePattern] = useState("");
  const [respectRobots, setRespectRobots] = useState(true);
  const [textOnly, setTextOnly] = useState(true);
  const [pages, setPages] = useState<PageEntry[]>([]);
  const [exploring, setExploring] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, page: "" });
  const [error, setError] = useState("");

  if (!open) return null;

  const handleExplore = async () => {
    if (!url.trim() || !/^https?:\/\//.test(url.trim())) return;
    setExploring(true); setError(""); setPages([]);

    let html = "";
    // 1. Direct fetch (Tauri webview has CORS disabled)
    try { const r = await fetch(url); if (r.ok) html = await r.text(); } catch {}
    // 2. Local Vite proxy (works in npm run dev — server-side fetch, no CORS)
    if (!html) { try { const r = await fetch(`/api/proxy?url=${encodeURIComponent(url)}`); if (r.ok) html = await r.text(); } catch {} }
    // 3. External CORS proxies (fallback)
    if (!html) { try { const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`); if (r.ok) html = await r.text(); } catch {} }

    if (!html || html.length < 100) {
      setError(`Could not fetch content from ${new URL(url).hostname}. The site may block automated access. Try: 1) Opening the page in your browser 2) Saving as PDF 3) Importing the PDF file instead.`);
      setExploring(false);
      return;
    }

    try {
      const baseUrl = new URL(url);
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const found: PageEntry[] = [{ url, title: doc.title || baseUrl.hostname, checked: true }];
      const seen = new Set<string>([url]);

      // Crawl internal links
      const anchors = doc.querySelectorAll("a[href]");
      for (const a of anchors) {
        if (found.length >= limit) break;
        const href = a.getAttribute("href") || "";
        try {
          const resolved = new URL(href, baseUrl.origin);
          const rs = resolved.href.split("#")[0];
          if (!rs.startsWith(baseUrl.origin)) continue;
          if (excludePattern && new RegExp(excludePattern).test(resolved.pathname)) continue;
          if (seen.has(rs)) continue;
          seen.add(rs);
          found.push({ url: rs, title: a.textContent?.trim().slice(0,80) || resolved.pathname, checked: true });
        } catch { /* skip malformed URLs */ }
      }

      setPages(found.slice(0, limit));
    } catch (e: any) {
      setError(`Error parsing page: ${e.message || "Unknown error"}`);
    }
    setExploring(false);
  };

  const toggleAll = (val: boolean) => setPages(prev => prev.map(p => p.blocked ? p : { ...p, checked: val }));

  const handleImport = async () => {
    const selected = pages.filter(p => p.checked && !p.blocked);
    if (!selected.length) { toast.warning("No pages selected", "Check at least one page to import."); return; }
    if (!project?.id) { toast.warning("No project open", "Open or create a project first to import documents."); return; }
    setImporting(true);
    let imported = 0, failed = 0;
    const failedUrls: string[] = [];

    for (let i = 0; i < selected.length; i++) {
      const p = selected[i];
      setProgress({ current: i+1, total: selected.length, page: p.url });

      // Fetch page: direct (Tauri, no CORS) then proxies (browser)
      let html: string | null = null;
      // 1. Direct fetch (Tauri: no CORS)
      try { const r = await fetch(p.url); if (r.ok) html = await r.text(); } catch {}
      // 2. Local Vite proxy (dev mode: server-side, no CORS)
      if (!html) { try { const r = await fetch(`/api/proxy?url=${encodeURIComponent(p.url)}`); if (r.ok) html = await r.text(); } catch {} }
      // 3. External proxy (last resort)
      if (!html) { try { const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(p.url)}`); if (r.ok) html = await r.text(); } catch {} }

      if (!html || html.length < 100) {
        failed++;
        failedUrls.push(p.url);
        continue;
      }

      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const reader = new Readability(doc);
        const article = reader.parse();
        const content = textOnly ? (article?.textContent||"") : (article?.content||"");
        const title = article?.title || p.title || new URL(p.url).hostname;
        const meta = JSON.stringify({ tipo:"web", url_origen:p.url, scraped:true, sourceUrl:url });
        const docId = await saveDocumentWeb(project.id, title, "web", p.url,
          content ? `<h1>${title}</h1><div>${content}</div>` : `<p>Content from ${p.url}</p>`,
          meta);
        // Update UI directly (no addDocument to avoid overwriting via save_documento)
        useProjectStore.setState(s => ({
          documents: [...s.documents, {
            id: docId||`scrape-${Date.now()}-${imported}`,
            name: title, type: "txt" as const, path: p.url,
            size: content.length,
            addedAt: new Date().toISOString(),
            metadata_json: meta,
          }]
        }));
        imported++;
      } catch (e: any) {
        failed++;
        failedUrls.push(p.url);
      }

      if (i < selected.length-1) await new Promise(r => setTimeout(r, 500));
    }

    if (imported > 0) {
      const detail = failed > 0 ? `⚠ ${failed} failed` : '';
      toast.success(`✅ ${imported} pages imported`, detail);
      onClose();
    } else {
      toast.error("Import failed", `All ${failed} pages failed. The site may block automated access. Try copying text manually or saving as PDF.`);
    }
    setImporting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[720px] rounded-xl p-6 shadow-xl" style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Globe size={18} style={{ color: "#9b59b6" }} />🕷 Web Crawler</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>

        {/* Informative header */}
        <div className="mb-4 rounded-lg p-3 text-xs" style={{ backgroundColor: "#E8F5E9", color: "#2E7D32" }}>
          <p className="font-semibold">🕷 Web Crawler — What will be imported?</p>
          <p className="mt-1 opacity-80">Automatically crawls a website's pages and extracts the main text from each. Ideal for: institutional sites, news portals, public document repositories. Each page is saved as a separate document.</p>
        </div>

        {/* URL */}
        <label className="block text-xs font-semibold mb-1 opacity-60">Starting URL</label>
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com"
          className="mb-3 w-full rounded-md border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />

        {/* Options */}
        <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <label className="block opacity-40 mb-0.5">Max depth</label>
            <select value={depth} onChange={e=>setDepth(Number(e.target.value))}
              className="w-full rounded border px-2 py-1.5 text-xs" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
              {[1,2,3].map(n=><option key={n} value={n}>{n} level{n>1?"s":""}</option>)}
            </select>
          </div>
          <div>
            <label className="block opacity-40 mb-0.5">Page limit</label>
            <select value={limit} onChange={e=>setLimit(Number(e.target.value))}
              className="w-full rounded border px-2 py-1.5 text-xs" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
              {[10,25,50,100].map(n=><option key={n} value={n}>{n} pages</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-1.5 cursor-pointer pb-1.5"><input type="checkbox" checked={textOnly} onChange={e=>setTextOnly(e.target.checked)} style={{accentColor:"#9b59b6"}}/>Text only</label>
          </div>
        </div>
        <div className="mb-3 flex items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={respectRobots} onChange={e=>setRespectRobots(e.target.checked)} style={{accentColor:"#9b59b6"}}/>Respect robots.txt</label>
          <input type="text" value={excludePattern} onChange={e=>setExcludePattern(e.target.value)} placeholder="Exclude: /login /admin"
            className="flex-1 rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
        </div>

        <button onClick={handleExplore} disabled={!url.trim()||exploring}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 min-touch" style={{ backgroundColor: "#9b59b6" }}>
          {exploring ? <><Loader2 size={14} className="animate-spin"/>Exploring site...</> : <><Search size={14}/> Explore site</>}
        </button>

        {error && <div className="mb-3 rounded-md border p-2 text-xs flex items-start gap-2" style={{ borderColor: "#FFCDD2", backgroundColor: "#FFEBEE", color: "#C62828" }}><AlertTriangle size={14} className="mt-0.5"/>{error}</div>}

        {pages.length > 0 && (
          <div className="mb-4 max-h-[200px] overflow-y-auto rounded-md border" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 border-b px-3 py-1.5 text-[10px]" style={{ borderColor: "var(--border)" }}>
              <button onClick={()=>toggleAll(true)} className="hover:underline" style={{color:"#9b59b6"}}>Select all</button>
              <button onClick={()=>toggleAll(false)} className="hover:underline opacity-50">Deselect all</button>
              <span className="flex-1 text-right opacity-40">{pages.filter(p=>p.checked).length}/{pages.length} selected</span>
            </div>
            {pages.map((p, i) => (
              <label key={i} className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-gray-50 ${p.blocked?"opacity-40":""}`}>
                <input type="checkbox" checked={p.checked} disabled={p.blocked} onChange={()=>setPages(prev=>prev.map((item,idx)=>idx===i?{...item,checked:!item.checked}:item))} style={{accentColor:"#9b59b6"}}/>
                <span className="flex-1 truncate">{p.title||p.url}</span>
                {p.blocked && <span className="text-[10px] text-red-400">🚫 Blocked</span>}
              </label>
            ))}
          </div>
        )}

        {importing && (
          <div className="mb-4">
            <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: "var(--border)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progress.total>0?(progress.current/progress.total)*100:0}%`, backgroundColor: "#9b59b6" }}/>
            </div>
            <p className="mt-1 text-center text-[10px] opacity-40">Processing page {progress.current} of {progress.total}: {progress.page?.slice(0,60)}...</p>
          </div>
        )}

        {pages.filter(p=>p.checked).length > 0 && !importing && (
          <button onClick={handleImport} className="flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium text-white hover:opacity-90 min-touch" style={{ backgroundColor: "#9b59b6" }}>
            <Download size={14}/> Import {pages.filter(p=>p.checked).length} pages
          </button>
        )}
      </div>
    </div>
  );
}
export default WebScraperImporter;
