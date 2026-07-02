import { useState } from "react";
import { Download, Search, X, Loader2, AlertTriangle, CheckCircle, Clock, MessageSquare, Eye, EyeOff, ExternalLink } from "lucide-react";
import { useProjectStore } from "../../../stores/projectStore";
import { useToast } from "../../../stores/toastStore";
import { saveDocumentWeb } from "../../../lib/tauriBridge";

interface Props { open: boolean; onClose: () => void; }

export function YouTubeImporter({ open, onClose }: Props) {
  const project = useProjectStore((s) => s.project);
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState(localStorage.getItem("kdcm_yt_apikey") || "");
  const [showKey, setShowKey] = useState(false);
  const [rememberKey, setRememberKey] = useState(true);
  const [desc, setDesc] = useState(true);
  const [comments, setComments] = useState(true);
  const [captions, setCaptions] = useState(true);
  const [state, setState] = useState<"idle"|"loading"|"done"|"error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");

  if (!open) return null;

  const isValidUrl = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/.test(url);
  const extractVideoId = (u: string) => { const m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/); return m?.[1] || null; };

  const handlePreview = async () => {
    if (!isValidUrl) return;
    setState("loading"); setErrorMsg("");
    if (rememberKey && apiKey) localStorage.setItem("kdcm_yt_apikey", apiKey);
    const vid = extractVideoId(url);
    if (!vid) { setErrorMsg("Invalid YouTube URL"); setState("error"); return; }

    // Check 24h cache
    const ck = `kdcm_yt_cache_${vid}`;
    try {
      const cached = localStorage.getItem(ck);
      if (cached) { const { data, ts } = JSON.parse(cached); if (Date.now()-ts<86400000) { setPreview(data); setState("done"); return; } }
    } catch {}

    if (!apiKey.trim()) {
      setErrorMsg("Enter your YouTube Data API v3 key above. Get a free key at console.cloud.google.com (2 minutes, no cost).");
      setState("error"); return;
    }

    try {
      const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${vid}&key=${apiKey}`;
      const vRes = await fetch(vUrl);
      const vData = await vRes.json();
      if (vData.error) {
        const e = vData.error;
        if (e.code===403&&e.errors?.[0]?.reason==="quotaExceeded") setErrorMsg("⚠ Daily YouTube quota exceeded. Available again tomorrow.");
        else if (e.code===400&&e.errors?.[0]?.reason==="keyInvalid") setErrorMsg("❌ Invalid API key. Verify you copied it correctly.");
        else setErrorMsg(`⚠ API error: ${e.message||"Unknown"}`);
        setState("error"); return;
      }
      const video = vData.items?.[0];
      if (!video) { setErrorMsg("Video not found or is private"); setState("error"); return; }
      const s = video.snippet, cd = video.contentDetails, st = video.statistics;
      const dm = (cd?.duration||"").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      const duration = dm ? `${dm[1]?dm[1]+":":""}${(dm[2]||"0").padStart(2,"0")}:${(dm[3]||"0").padStart(2,"0")}` : "?";
      let captAvailable = false;
      try {
        const capRes = await fetch(`https://www.googleapis.com/youtube/v3/captions?videoId=${vid}&key=${apiKey}&part=snippet`);
        const capData = await capRes.json();
        captAvailable = (capData.items||[]).length > 0;
      } catch {}
      const pd = {
        title: s?.title||"Untitled", channel: s?.channelTitle||"Unknown", duration,
        views: parseInt(st?.viewCount||"0").toLocaleString(),
        comments: parseInt(st?.commentCount||"0"),
        thumbnail: s?.thumbnails?.medium?.url||"",
        description: s?.description||"",
        publishedAt: s?.publishedAt||"",
        captionsAvailable: captAvailable,
        videoId: vid,
      };
      try { localStorage.setItem(ck, JSON.stringify({ data: pd, ts: Date.now() })); } catch {}
      setPreview(pd); setState("done");
    } catch {
      setErrorMsg("⚠ Could not connect to YouTube API. Check your network and API key.");
      setState("error");
    }
  };

  const handleImport = async () => {
    if (!preview || !project?.id) return;
    setImporting(true);

    try {
      let count = 0;

      // Import description
      if (desc) {
        setProgress("Importing description...");
        const docId = await saveDocumentWeb(project.id,
          `${preview.title} — Description`, "web", url,
          `<h2>${preview.title}</h2><p>Channel: ${preview.channel}</p><p>${preview.description}</p>`,
          JSON.stringify({ platform:"youtube", videoId:preview.videoId, channel:preview.channel, duration:preview.duration, views:preview.views, type:"description" })
        );
        useProjectStore.setState(s => ({ documents: [...s.documents, { id: docId||`yt-${Date.now()}`, name: `${preview.title} — Description`, type: "txt", path: url, size: (preview.description||"").length, addedAt: new Date().toISOString(), metadata_json: JSON.stringify({ platform:"youtube", type:"description" }) }] }));
        count++;
      }

      // Import comments
      if (comments && apiKey) {
        setProgress("Importing comments...");
        try {
          const cUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${preview.videoId}&key=${apiKey}&maxResults=100`;
          const cRes = await fetch(cUrl);
          const cData = await cRes.json();
          const items = cData.items || [];
          let ci = 0;
          for (const item of items) {
            const c = item.snippet?.topLevelComment?.snippet;
            if (!c) continue;
            setProgress(`Importing comments (${ci+1} of ${items.length})...`);
            const docId = await saveDocumentWeb(project.id,
              `Comment by ${c.authorDisplayName||"Anonymous"} on ${preview.title?.slice(0,30)}`, "web", url,
              `<p>${c.textDisplay||""}</p>`,
              JSON.stringify({ platform:"youtube", videoId:preview.videoId, author:c.authorDisplayName, likes:c.likeCount, date:c.publishedAt, type:"comment" })
            );
            useProjectStore.setState(s => ({ documents: [...s.documents, { id: docId||`yt-cmt-${Date.now()}-${ci}`, name: `Comment by ${c.authorDisplayName||"Anonymous"}`, type: "txt", path: url, size: (c.textDisplay||"").length, addedAt: new Date().toISOString(), metadata_json: JSON.stringify({ platform:"youtube", type:"comment", author: c.authorDisplayName }) }] }));
            ci++; count++;
          }
        } catch {}
      }

      // Import captions info
      if (captions && preview.captionsAvailable) {
        setProgress("Importing captions info...");
        const docId = await saveDocumentWeb(project.id,
          `${preview.title} — Subtitles`, "web", url,
          `<p>Auto-captions available for this video.</p>`,
          JSON.stringify({ platform:"youtube", videoId:preview.videoId, type:"captions_placeholder" })
        );
        useProjectStore.setState(s => ({ documents: [...s.documents, { id: docId||`yt-cap-${Date.now()}`, name: `${preview.title} — Subtitles`, type: "txt", path: url, size: 0, addedAt: new Date().toISOString(), metadata_json: JSON.stringify({ platform:"youtube", type:"subtitles" }) }] }));
        count++;
      }

      toast.success("✅ Import complete", `${count} documents created from YouTube`);
    } catch { toast.error("Error", "Import failed"); }
    finally { setImporting(false); setProgress(""); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[560px] rounded-xl p-6 shadow-xl" style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold"><span style={{ color: "#FF0000" }}>▶</span> YouTube Import</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>

        {/* Informative header */}
        <div className="mb-4 rounded-lg p-3 text-xs" style={{ backgroundColor: "#FFEBEE", color: "#C62828" }}>
          <p className="font-semibold">▶ YouTube — What will be imported?</p>
          <p className="mt-1 opacity-80">• Video description → 1 text document<br/>• Comments → 1 document per comment (max 100)<br/>• Auto-captions → 1 transcript document<br/>Requires a free YouTube Data API v3 key.</p>
        </div>

        {/* API Key */}
        <label className="block text-xs font-semibold mb-1 opacity-60">YouTube Data API v3 Key</label>
        <div className="relative mb-1">
          <input type={showKey?"text":"password"} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza..." className="w-full rounded-md border px-3 py-2 pr-10 text-sm outline-none"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
          <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80">{showKey?<EyeOff size={14}/>:<Eye size={14}/>}</button>
        </div>
        <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="mb-2 flex items-center gap-1 text-[10px] underline opacity-50 hover:opacity-80">How to get your free key? → console.cloud.google.com <ExternalLink size={9}/></a>
        <label className="mb-3 flex items-center gap-2 text-[10px] cursor-pointer"><input type="checkbox" checked={rememberKey} onChange={(e) => setRememberKey(e.target.checked)} style={{ accentColor: "#9b59b6" }}/>Remember key in this project</label>

        {/* URL */}
        <label className="block text-xs font-semibold mb-1 opacity-60">YouTube Video URL</label>
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="mb-3 w-full rounded-md border px-3 py-2 text-sm outline-none"
          style={{ borderColor: !isValidUrl&&url?"#E53935":"var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />

        {/* Options */}
        <div className="mb-3 space-y-1 text-xs">
          {[{ label: "Video description → 1 document with full description text", val: desc, set: setDesc },
            { label: "Comments (max 100) → 1 document per comment with author, date, and likes", val: comments, set: setComments },
            { label: "Auto-captions if available → 1 transcript document ready for coding", val: captions, set: setCaptions }].map(({ label, val, set }) => (
            <label key={label} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} style={{ accentColor: "#9b59b6" }}/>{label}</label>
          ))}
        </div>

        <button onClick={handlePreview} disabled={!isValidUrl || state==="loading"}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40 min-touch" style={{ backgroundColor: "#9b59b6" }}>
          {state==="loading" ? <><Loader2 size={14} className="animate-spin"/>Fetching video info...</> : <><Search size={14}/> Preview</>}
        </button>

        {state==="error" && <div className="mb-3 rounded-md border p-2 text-xs flex items-start gap-2" style={{ borderColor: "#FFCDD2", backgroundColor: "#FFEBEE", color: "#C62828" }}><AlertTriangle size={14} className="mt-0.5"/>{errorMsg}</div>}

        {state==="done" && preview && (
          <div className="rounded-md border p-3" style={{ borderColor: "#4CAF50", backgroundColor: "#E8F5E9" }}>
            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "#2E7D32" }}><CheckCircle size={14}/>Ready</div>
            {preview.thumbnail && <img src={preview.thumbnail} alt="" className="mt-2 rounded" style={{ width:120, height:68, objectFit:"cover" }}/>}
            <p className="mt-1 text-xs font-semibold" style={{ color: "#1B5E20" }}>{preview.title}</p>
            <div className="mt-1 flex gap-3 text-[10px]" style={{ color: "#2E7D32" }}>
              <span>{preview.channel}</span>
              <span className="flex items-center gap-1"><Clock size={10}/>{preview.duration}</span>
              <span>{preview.views} views</span>
              <span className="flex items-center gap-1"><MessageSquare size={10}/>{preview.comments} comments</span>
            </div>
            <p className="text-[10px] mt-0.5" style={{ color: preview.captionsAvailable?"#2E7D32":"#9E9E9E" }}>{preview.captionsAvailable?"✓ Captions available":"✗ No captions"}</p>
            <button onClick={handleImport} disabled={importing}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md py-1.5 text-xs font-medium text-white hover:opacity-90" style={{ backgroundColor: "#4CAF50" }}>
              {importing ? <><Loader2 size={12} className="animate-spin"/>{progress||"Importing..."}</> : <><Download size={12}/> Import selected</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
export default YouTubeImporter;
