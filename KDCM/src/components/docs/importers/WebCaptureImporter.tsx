import { useState } from "react";
import { Globe, Search, CheckCircle, Loader2, AlertTriangle, X, Download } from "lucide-react";
import { useProjectStore } from "../../../stores/projectStore";
import { useToast } from "../../../stores/toastStore";
import { saveDocumentWeb } from "../../../lib/tauriBridge";
import { Readability } from "@mozilla/readability";

interface Props { open: boolean; onClose: () => void; }

type CaptureMode = "readability" | "clean-html" | "plain-text";

/**
 * Strip unwanted elements from a Document:
 * scripts, styles, nav, header, footer, iframes, noscript, svg, comments.
 * Returns cleaned body innerHTML.
 */
function cleanDocumentHTML(doc: Document): string {
  // Remove unwanted elements
  const removals = ["script", "style", "nav", "header", "footer", "iframe", "noscript", "svg", "link", "meta", "input", "button", "select", "textarea", "form"];
  removals.forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  });
  // Remove hidden elements (display:none, visibility:hidden, aria-hidden)
  doc.querySelectorAll("*").forEach(el => {
    const style = (el as HTMLElement).style;
    if (style?.display === "none" || style?.visibility === "hidden" || el.getAttribute("aria-hidden") === "true") {
      el.remove();
    }
  });
  // Remove common sidebar/ad classes
  const adSelectors = [
    "[class*='sidebar']", "[class*='nav-']", "[class*='menu-']",
    "[class*='footer']", "[class*='header-']", "[class*='banner']",
    "[class*='ad-']", "[class*='-ad']", "[id*='sidebar']",
    "[id*='footer']", "[id*='nav']", "[role='navigation']",
    "[role='banner']", "[role='contentinfo']",
  ];
  adSelectors.forEach(sel => {
    try { doc.querySelectorAll(sel).forEach(el => el.remove()); } catch {}
  });

  const body = doc.body;
  if (!body) return "";
  return body.innerHTML || body.textContent || "";
}

export function WebCaptureImporter({ open, onClose }: Props) {
  const project = useProjectStore((s) => s.project);
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [mode, setMode] = useState<CaptureMode>("readability");
  const [state, setState] = useState<"idle"|"loading"|"done"|"error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState<{title:string;author:string;snippet:string;wordCount:number;htmlContent:string}|null>(null);
  const [importing, setImporting] = useState(false);

  if (!open) return null;

  const validateUrl = (val: string) => {
    if (!val.trim()) { setUrlError(""); return false; }
    if (!/^https?:\/\//.test(val.trim())) { setUrlError("⚠ Enter a valid URL (must start with https://)"); return false; }
    setUrlError("");
    return true;
  };

  const fetchPage = async (targetUrl: string): Promise<string> => {
    try { const r = await fetch(targetUrl); if (r.ok) return await r.text(); } catch {}
    try { const r = await fetch(`/api/proxy?url=${encodeURIComponent(targetUrl)}`); if (r.ok) return await r.text(); } catch {}
    try { const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`); if (r.ok) return await r.text(); } catch {}
    return "";
  };

  const handlePreview = async () => {
    if (!validateUrl(url)) return;
    setState("loading"); setErrorMsg("");
    try {
      const rawHtml = await fetchPage(url);
      if (!rawHtml) throw new Error("Could not fetch page. The site may block automated access or require login.");

      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, "text/html");
      const hostname = new URL(url).hostname;

      // Run Readability for article mode
      const reader = new Readability(doc.cloneNode(true) as Document);
      const article = reader.parse();

      let title = hostname;
      let author = "Not detected";
      let htmlContent = "";
      let wordCount = 0;
      let snippet = "";
      let warning = "";

      if (mode === "readability") {
        // ── Readability mode: best for articles/blogs ──
        if (article && article.textContent && article.textContent.split(/\s+/).filter(Boolean).length > 20) {
          title = article.title || hostname;
          author = article.byline || "Not detected";
          htmlContent = article.content || `<p>${article.textContent}</p>`;
          const text = article.textContent;
          wordCount = text.split(/\s+/).filter(Boolean).length;
          snippet = text.slice(0, 300);
        } else {
          // Readability failed — fall back to clean HTML with warning
          title = article?.title || doc.title || hostname;
          htmlContent = cleanDocumentHTML(doc);
          const text = doc.body?.textContent || "";
          wordCount = text.split(/\s+/).filter(Boolean).length;
          snippet = text.slice(0, 300);
          warning = "⚠ Readability found very little content (page may be JS-rendered). Showing clean HTML instead. Try 'Plain text' mode if the result has too much markup.";
        }
      } else if (mode === "clean-html") {
        // ── Clean HTML mode: strip scripts/nav/ads, keep body content ──
        title = article?.title || doc.title || hostname;
        htmlContent = cleanDocumentHTML(doc);
        const text = doc.body?.textContent || "";
        wordCount = text.split(/\s+/).filter(Boolean).length;
        snippet = text.slice(0, 300);
      } else {
        // ── Plain text mode: visible text only, with line breaks ──
        title = article?.title || doc.title || hostname;
        const text = (doc.body?.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
        wordCount = text.split(/\s+/).filter(Boolean).length;
        snippet = text.slice(0, 300);
        htmlContent = `<h1>${title}</h1>\n<pre style="white-space:pre-wrap;font-family:inherit;">${text}</pre>`;
      }

      if (warning) setErrorMsg(warning);

      setPreview({ title, author, snippet, wordCount, htmlContent });
      setState("done");
    } catch (e: any) {
      setErrorMsg(e.message || "⚠ Could not extract content automatically.");
      setState("error");
    }
  };

  const handleImport = async () => {
    if (!preview || !project?.id) return;
    setImporting(true);
    try {
      const meta = JSON.stringify({ tipo: "web", url_origen: url, mode, author: preview.author, wordCount: preview.wordCount });
      const docId = await saveDocumentWeb(project.id, preview.title, "web", url, preview.htmlContent, meta);
      useProjectStore.setState(s => ({
        documents: [...s.documents, {
          id: docId || `doc-web-${Date.now()}`, name: preview.title,
          type: "txt", path: url, size: preview.wordCount || 0,
          addedAt: new Date().toISOString(), metadata_json: meta,
        }]
      }));
      toast.success("✅ Imported", `"${preview.title}" — ${preview.wordCount} words`);
      onClose();
    } catch (err: any) {
      console.error("WebCapture import failed:", err);
      toast.error("Error", `Could not save document: ${err?.message || err || "unknown error"}`);
    } finally { setImporting(false); }
  };

  const modes: { id: CaptureMode; label: string; desc: string }[] = [
    { id: "readability", label: "Article", desc: "Extracts main content. Best for: news, blogs, docs." },
    { id: "clean-html", label: "Clean HTML", desc: "Body text with formatting, no scripts/ads/menus." },
    { id: "plain-text", label: "Plain text", desc: "Visible text only, no tags. For any page type." },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[580px] rounded-xl p-6 shadow-xl" style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Globe size={18} style={{ color: "#9b59b6" }} />🌐 Web Capture</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>

        {/* Info header */}
        <div className="mb-4 rounded-lg p-3 text-xs" style={{ backgroundColor: "#F3E5F5", color: "#6B2D80" }}>
          <p className="font-semibold">🌐 Import text from any public URL</p>
          <p className="mt-1 opacity-80">The page is fetched and its visible text content is extracted. JS-rendered content (shops, SPAs) may have limited results — the static HTML is used.</p>
        </div>

        {/* URL input */}
        <label className="block text-xs font-semibold mb-1 opacity-60">URL</label>
        <input type="url" value={url} onChange={(e) => { setUrl(e.target.value); if (urlError) validateUrl(e.target.value); }}
          placeholder="https://example.com/article"
          onKeyDown={(e) => { if (e.key === "Enter") handlePreview(); }}
          className={`mb-1 w-full rounded-md border px-3 py-2 text-sm outline-none ${urlError ? "border-red-400" : ""}`}
          style={{ borderColor: urlError ? "#E53935" : "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
        {urlError && <p className="mb-2 text-xs text-red-500">{urlError}</p>}

        {/* Mode selector */}
        <div className="mb-3">
          <label className="block text-[10px] font-medium opacity-40 uppercase mb-1">Mode</label>
          <div className="flex gap-1">
            {modes.map((m) => (
              <button key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex-1 rounded-md border px-2 py-1.5 text-[10px] font-medium transition-colors min-touch ${mode === m.id ? "" : "opacity-50 hover:opacity-80"}`}
                style={{
                  borderColor: mode === m.id ? "var(--peach)" : "var(--border)",
                  backgroundColor: mode === m.id ? "rgba(155,89,182,0.08)" : "transparent",
                  color: mode === m.id ? "#000" : "#000",
                }}>
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-[9px] opacity-40 mt-1">{modes.find(m=>m.id===mode)?.desc}</p>
        </div>

        <button onClick={handlePreview} disabled={!url.trim() || state==="loading"}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 min-touch" style={{ backgroundColor: "#9b59b6" }}>
          {state==="loading" ? <><Loader2 size={14} className="animate-spin"/> Fetching...</> : <><Search size={14}/> Preview</>}
        </button>

        {state==="error" && (
          <div className="rounded-md border p-3 text-xs" style={{ borderColor: "#FFCDD2", backgroundColor: "#FFEBEE", color: "#C62828" }}>
            <div className="flex items-center gap-2 font-medium"><AlertTriangle size={14}/>Error</div>
            <p className="mt-1">{errorMsg}</p>
          </div>
        )}

        {state==="done" && preview && (
          <div className="rounded-md border p-3" style={{ borderColor: "#4CAF50", backgroundColor: "#E8F5E9" }}>
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "#2E7D32" }}><CheckCircle size={14}/>Ready — {preview.wordCount} words</div>
            <p className="mt-1 text-xs font-semibold" style={{ color: "#1B5E20" }}>{preview.title}</p>
            {preview.author !== "Not detected" && <p className="text-[10px] opacity-70" style={{ color: "#1B5E20" }}>Author: {preview.author}</p>}
            <p className="mt-1 text-xs opacity-60 max-h-20 overflow-hidden" style={{ color: "#1B5E20" }}>{preview.snippet}...</p>
            {errorMsg && errorMsg.startsWith("⚠") && (
              <p className="mt-1 text-[10px] text-amber-600">{errorMsg}</p>
            )}
            <button onClick={handleImport} disabled={importing}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md py-1.5 text-xs font-medium text-white hover:opacity-90" style={{ backgroundColor: "#4CAF50" }}>
              {importing ? <><Loader2 size={12} className="animate-spin"/> Saving...</> : <><Download size={12}/> Import to project</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
export default WebCaptureImporter;
