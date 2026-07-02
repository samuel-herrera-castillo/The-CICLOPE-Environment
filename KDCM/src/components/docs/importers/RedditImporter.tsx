import { useState } from "react";
import { Download, Search, X, CheckCircle, ExternalLink, Loader2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { useProjectStore } from "../../../stores/projectStore";
import { useToast } from "../../../stores/toastStore";
import { saveDocumentWeb } from "../../../lib/tauriBridge";

interface Props { open: boolean; onClose: () => void; }

export function RedditImporter({ open, onClose }: Props) {
  const project = useProjectStore((s) => s.project);
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [showCreds, setShowCreds] = useState(false);
  const [clientId, setClientId] = useState(localStorage.getItem("kdcm_reddit_cid")||"");
  const [clientSecret, setClientSecret] = useState("");
  const [userAgent, setUserAgent] = useState("KDCM/1.0");
  const [rememberCreds, setRememberCreds] = useState(true);
  const [importPost, setImportPost] = useState(true);
  const [importComments, setImportComments] = useState(true);
  const [limit, setLimit] = useState(100);
  const [state, setState] = useState<"idle"|"loading"|"done"|"error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");

  if (!open) return null;

  const extractInfo = (input: string) => {
    const m = input.match(/reddit\.com\/r\/([^/]+)\/comments\/([a-z0-9]+)/i);
    if (m) return { type:"thread", subreddit:m[1], id:m[2] };
    const s = input.match(/reddit\.com\/r\/([^/]+)/i);
    if (s) return { type:"subreddit", id:s[1] };
    return null;
  };

  const handlePreview = async () => {
    if (!url.trim()) return;
    setState("loading"); setErrorMsg("");
    if (rememberCreds && clientId) localStorage.setItem("kdcm_reddit_cid", clientId);
    const info = extractInfo(url);
    if (!info) { setErrorMsg("Enter a valid Reddit thread URL (reddit.com/r/.../comments/...)"); setState("error"); return; }

    try {
      let token = "";
      if (clientId && clientSecret) {
        const basic = btoa(`${clientId}:${clientSecret}`);
        const tRes = await fetch("https://www.reddit.com/api/v1/access_token", {
          method:"POST", headers:{ Authorization:`Basic ${basic}`, "Content-Type":"application/x-www-form-urlencoded" },
          body:"grant_type=client_credentials"
        });
        if (tRes.ok) { const tData = await tRes.json(); token = tData.access_token||""; }
      }

      const headers: Record<string,string> = { "User-Agent": userAgent||"KDCM/1.0" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let apiUrl = info.type==="thread"
        ? `https://oauth.reddit.com/r/${info.subreddit}/comments/${info.id}?limit=${limit}`
        : `https://oauth.reddit.com/r/${info.id}/top?limit=${limit}`;

      const res = await fetch(apiUrl, { headers });
      if (!res.ok) {
        if (res.status===401) setErrorMsg("❌ Invalid credentials. Verify your Client ID and Client Secret at reddit.com/prefs/apps");
        else if (res.status===429) setErrorMsg("⚠ Rate limited. Try again in a few minutes.");
        else setErrorMsg(`Error ${res.status}. Check the URL and try again.`);
        setState("error"); return;
      }

      const data = await res.json();
      if (Array.isArray(data) && data.length>=2) {
        const post = data[0]?.data?.children?.[0]?.data;
        const cmts = data[1]?.data?.children||[];
        setPreview({
          title: post?.title||"Untitled", subreddit: `r/${post?.subreddit||"?"}`,
          author: `u/${post?.author||"?"}`, score: post?.ups||0,
          text: post?.selftext||"", numComments: cmts.length,
          comments: cmts.slice(0,10).map((c:any)=>({
            author: c.data?.author, body: c.data?.body?.slice(0,200),
            score: c.data?.ups, date: c.data?.created_utc
          }))
        });
      } else {
        const posts = (data?.data?.children||[]).slice(0,5).map((c:any)=>({ title:c.data?.title, score:c.data?.ups }));
        setPreview({ title:posts[0]?.title||`${posts.length} posts`, posts, subreddit:`r/${info.id}` });
      }
      setState("done");
    } catch { setErrorMsg("Could not connect to Reddit. Check your network."); setState("error"); }
  };

  const handleImport = async () => {
    if (!preview || !project?.id) return;
    setImporting(true);
    try {
      let count = 0;
          if (importPost) {
        setProgress("Importing post...");
        const docId = await saveDocumentWeb(project.id, preview.title, "web", url,
          `<h2>${preview.title}</h2><p>r/${preview.subreddit} · u/${preview.author} · ${preview.score} points</p><p>${preview.text||""}</p>`,
          JSON.stringify({ platform:"reddit", subreddit:preview.subreddit, author:preview.author, score:preview.score, type:"post" })
        );
        useProjectStore.setState(s => ({ documents: [...s.documents, { id: docId||`reddit-${Date.now()}`, name: preview.title, type: "txt", path: url, size: (preview.text||"").length, addedAt: new Date().toISOString(), metadata_json: JSON.stringify({ platform:"reddit", type:"post" }) }] }));
        count++;
      }

      if (importComments && preview.comments) {
        let ci = 0;
        for (const c of preview.comments) {
          setProgress(`Importing comments (${ci+1} of ${preview.comments.length})...`);
          const docId = await saveDocumentWeb(project.id,
            `Comment by ${c.author||"Anonymous"} on ${preview.title?.slice(0,40)}`, "web", url,
            `<p>${c.body||""}</p>`,
            JSON.stringify({ platform:"reddit", author:c.author, score:c.score, date:new Date((c.date||0)*1000).toISOString(), type:"comment" })
          );
          useProjectStore.setState(s => ({ documents: [...s.documents, { id: docId||`reddit-cmt-${Date.now()}-${ci}`, name: `Comment by ${c.author||"Anonymous"}`, type: "txt", path: url, size: (c.body||"").length, addedAt: new Date().toISOString(), metadata_json: JSON.stringify({ platform:"reddit", type:"comment" }) }] }));
          ci++; count++;
        }
      }

      toast.success("✅ Import complete", `${count} documents imported from Reddit`);
    } catch { toast.error("Error", "Import failed"); }
    finally { setImporting(false); setProgress(""); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[560px] rounded-xl p-6 shadow-xl" style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold"><span style={{ color: "#FF4500" }}>🔴</span> Reddit Import</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>

        {/* Informative header */}
        <div className="mb-4 rounded-lg p-3 text-xs" style={{ backgroundColor: "#FFF3E0", color: "#E65100" }}>
          <p className="font-semibold">🔴 Reddit — What will be imported?</p>
          <p className="mt-1 opacity-80">• Main post → 1 document with full text, author, subreddit, and score<br/>• Comments → 1 document per comment with author, score, and date<br/>Requires free Reddit API credentials.</p>
        </div>

        {/* Credentials (collapsible) */}
        <button onClick={() => setShowCreds(!showCreds)} className="mb-2 flex items-center gap-1 text-xs font-medium opacity-50 hover:opacity-80">
          {showCreds?<ChevronDown size={12}/>:<ChevronRight size={12}/>} Reddit API Credentials
        </button>
        {showCreds && (
          <div className="mb-3 space-y-2">
            <input type="text" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
            <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Client Secret"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
            <input type="text" value={userAgent} onChange={(e) => setUserAgent(e.target.value)} placeholder="User Agent (e.g. KDCM/1.0)"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
            <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] underline opacity-50">How to get credentials? reddit.com/prefs/apps → Create App → Script <ExternalLink size={9}/></a>
            <label className="flex items-center gap-2 text-[10px] cursor-pointer"><input type="checkbox" checked={rememberCreds} onChange={(e) => setRememberCreds(e.target.checked)} style={{ accentColor: "#9b59b6" }}/>Remember credentials</label>
          </div>
        )}

        {/* URL */}
        <label className="block text-xs font-semibold mb-1 opacity-60">Reddit Thread URL</label>
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.reddit.com/r/subreddit/comments/..."
          className="mb-2 w-full rounded-md border px-3 py-2 text-sm outline-none"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />

        {/* Options */}
        <div className="mb-2 space-y-1 text-xs">
          {[{ label: "Main post → 1 document with full post text, author, subreddit, and score", val: importPost, set: setImportPost },
            { label: "Comments (top-level) → 1 doc per comment with author, score, and date", val: importComments, set: setImportComments }
          ].map(({ label, val, set }) => (
            <label key={label} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} style={{ accentColor: "#9b59b6" }}/>{label}</label>
          ))}
        </div>
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}
          className="mb-3 rounded-md border px-2 py-1 text-xs outline-none" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
          {[50,100,200].map(n => <option key={n} value={n}>Max {n} comments</option>)}
        </select>

        <button onClick={handlePreview} disabled={!url.trim() || state==="loading"}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 min-touch" style={{ backgroundColor: "#9b59b6" }}>
          {state==="loading" ? <><Loader2 size={14} className="animate-spin"/>Fetching...</> : <><Search size={14}/> Preview</>}
        </button>

        {state==="error" && <div className="mb-3 rounded-md border p-2 text-xs flex items-start gap-2" style={{ borderColor: "#FFCDD2", backgroundColor: "#FFEBEE", color: "#C62828" }}><AlertTriangle size={14} className="mt-0.5"/>{errorMsg}</div>}

        {state==="done" && preview && (
          <div className="rounded-md border p-3" style={{ borderColor: "#4CAF50", backgroundColor: "#E8F5E9" }}>
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "#2E7D32" }}><CheckCircle size={14}/>Ready</div>
            <p className="mt-1 text-xs font-bold" style={{ color: "#1B5E20" }}>{preview.title}</p>
            <p className="text-[10px] opacity-70" style={{ color: "#1B5E20" }}>{preview.subreddit} · {preview.author} · {preview.score||0} points · {preview.numComments||0} comments</p>
            {preview.text && <p className="mt-1 text-xs italic opacity-60" style={{ color: "#1B5E20" }}>{(preview.text||"").slice(0,200)}...</p>}
            <button onClick={handleImport} disabled={importing}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md py-1.5 text-xs font-medium text-white hover:opacity-90" style={{ backgroundColor: "#4CAF50" }}>
              {importing ? <><Loader2 size={12} className="animate-spin"/>{progress||"Importing..."}</> : <><Download size={12}/> Import</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
export default RedditImporter;
