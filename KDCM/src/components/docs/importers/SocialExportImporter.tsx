import { useState } from "react";
import { Download, X, Loader2, FileArchive, CheckCircle } from "lucide-react";
import { useProjectStore } from "../../../stores/projectStore";
import { useToast } from "../../../stores/toastStore";
import { saveDocumentWeb } from "../../../lib/tauriBridge";
import JSZip from "jszip";

interface Props { open: boolean; onClose: () => void; }
type Platform = "twitter" | "facebook" | "instagram";

const PLATFORM_CONFIG: Record<Platform, { label: string; icon: string; color: string; instructions: string; what: string; parseFile: string }> = {
  twitter: {
    label: "Twitter/X", icon: "🐦", color: "#1DA1F2",
    instructions: "1. Go to twitter.com → More → Settings\n2. Your account → Download an archive of your data\n3. Confirm your identity\n4. You'll receive an email with the download link (may take hours)\n5. Download the ZIP and select it here",
    what: "→ Your tweets · Replies · Retweets with comments",
    parseFile: "tweets.js"
  },
  facebook: {
    label: "Facebook", icon: "👥", color: "#1877F2",
    instructions: "1. Go to facebook.com → Settings → Your Facebook Information\n2. Download your information\n3. Select: Posts, Comments, Messages\n4. Format: JSON · Quality: Low (text only)\n5. Download the ZIP when ready",
    what: "→ Your posts · Comments on your posts",
    parseFile: "posts"
  },
  instagram: {
    label: "Instagram", icon: "📷", color: "#E4405F",
    instructions: "1. Go to instagram.com → Settings → Privacy & Security\n2. Download data → Request download\n3. Choose JSON as the format\n4. You'll receive an email with the file",
    what: "→ Your posts with text · Comments",
    parseFile: "content"
  },
};

export function SocialExportImporter({ open, onClose }: Props) {
  const project = useProjectStore((s) => s.project);
  const { toast } = useToast();
  const [platform, setPlatform] = useState<Platform>("twitter");
  const [file, setFile] = useState<File | null>(null);
  const [count, setCount] = useState(0);
  const [importPosts, setImportPosts] = useState(true);
  const [importComments, setImportComments] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");

  if (!open) return null;

  const pc = PLATFORM_CONFIG[platform];

  const handleFile = async (f: File) => {
    if (!f.name.endsWith(".zip")) return;
    setFile(f);
    try {
      const zip = await JSZip.loadAsync(f);
      const files = Object.keys(zip.files).filter(n => !n.startsWith("__MACOSX") && !n.endsWith("/"));
      const contentFiles = files.filter(n => /tweet|post|status|comment|content|message|conversation/i.test(n) && /\.(js|json)$/i.test(n));
      setCount(contentFiles.length || files.length);
    } catch { toast.error("Error", "Could not read ZIP file"); }
  };

  const handleImport = async () => {
    if (!file || !project?.id) return;
    setImporting(true);
    try {
      const zip = await JSZip.loadAsync(file);
      const allFiles = Object.keys(zip.files).filter(n => !n.startsWith("__MACOSX") && !n.endsWith("/"));
      let imported = 0;

      // Try to find platform-specific files
      const jsonFiles = allFiles.filter(n => /\.(js|json)$/i.test(n));
      const mediaFiles = allFiles.filter(n => /\.(jpg|png|gif|webp|mp4|mov)$/i.test(n));

      // Parse structured data files for tweets/posts
      for (const name of jsonFiles) {
        if (!importPosts && !importComments) break;
        setProgress(`Processing ${name}...`);
        try {
          const entry = zip.files[name];
          if (!entry || entry.dir) continue;
          const rawText = await entry.async("text");

          // Try to extract structured data
          let data: any = null;
          try {
            // Twitter: tweets.js or tweet.js — JSON with window.YTD assignment
            if (platform === "twitter" && rawText.includes("YTD")) {
              const jsonStart = rawText.indexOf("= [") + 2;
              if (jsonStart > 2) data = JSON.parse(rawText.slice(jsonStart));
            }
            // Facebook/Instagram: direct JSON array or object
            if (!data) {
              try { data = JSON.parse(rawText); } catch {}
            }
          } catch {}

          if (Array.isArray(data) && importPosts) {
            for (const item of data.slice(0, 200)) {
              const tweet = item?.tweet || item;
              const text = tweet?.full_text || tweet?.text || tweet?.body || item?.post || "";
              if (typeof text !== "string" || !text.trim()) continue;
              const date = tweet?.created_at || item?.created_at || item?.timestamp || "";
              const meta = JSON.stringify({ platform, originalFile: name, date, type: "post" });
              const docId = await saveDocumentWeb(project.id,
                `${platform}: ${date?.slice(0,10)||"?"} — ${text.slice(0,60)}`, "web", null,
                `<p>${text}</p>`, meta);
              useProjectStore.setState(s => ({ documents: [...s.documents, { id: docId||`social-${Date.now()}-${imported}`, name: `${platform}: ${date?.slice(0,10)||"?"} — ${text.slice(0,60)}`, type: "txt", path: "", size: text.length, addedAt: new Date().toISOString(), metadata_json: meta }] }));
              imported++;
              if (imported % 50 === 0) await new Promise(r => setTimeout(r, 10));
            }
          }
        } catch {}
      }

      // Import media as documents too
      for (const name of mediaFiles.slice(0, 50)) {
        setProgress(`Importing media ${name}...`);
        try {
          const entry = zip.files[name];
          if (!entry || entry.dir) continue;
          const isVideo = /\.(mp4|mov)$/i.test(name);
          const docType = isVideo ? "video" as const : "image" as const;
          const meta = JSON.stringify({ platform, originalFile: name, type: "media" });
          const docId = await saveDocumentWeb(project.id,
            `${platform}: ${name}`, isVideo?"video":"image", null,
            `<p>Media file: ${name}</p>`, meta);
          useProjectStore.setState(s => ({ documents: [...s.documents, { id: docId||`social-media-${Date.now()}-${imported}`, name: `${platform}: ${name}`, type: docType, path: "", size: 0, addedAt: new Date().toISOString(), metadata_json: meta }] }));
          imported++;
        } catch {}
      }

      // Fallback: import all files
      if (imported === 0) {
        for (const name of allFiles.slice(0, 100)) {
          setProgress(`Importing ${name}...`);
          try {
            const entry = zip.files[name];
            if (!entry || entry.dir) continue;
            const text = await entry.async("text");
            const meta = JSON.stringify({ platform, originalFile: name, type: "file" });
            const docId = await saveDocumentWeb(project.id,
              `${platform}/${name}`, "txt", null, `<pre>${text.slice(0,5000)}</pre>`, meta);
            useProjectStore.setState(s => ({ documents: [...s.documents, { id: docId||`social-fallback-${Date.now()}-${imported}`, name: `${platform}/${name}`, type: "txt", path: "", size: text.length, addedAt: new Date().toISOString(), metadata_json: meta }] }));
            imported++;
            if (imported % 20 === 0) await new Promise(r => setTimeout(r, 10));
          } catch {}
        }
      }

      toast.success("✅ Import complete", `${imported} items imported from ${platform}`);
    } catch { toast.error("Error", "Could not import ZIP contents"); }
    finally { setImporting(false); setProgress(""); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[560px] rounded-xl p-6 shadow-xl" style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold"><FileArchive size={18} style={{ color: "#9b59b6" }} />📱 Social Media Import</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>

        {/* Platform selector */}
        <div className="mb-4 flex gap-1.5">
          {(Object.keys(PLATFORM_CONFIG) as Platform[]).map(p => (
            <button key={p} onClick={() => { setPlatform(p); setFile(null); setCount(0); }}
              className={`flex-1 rounded-md py-2 text-xs font-medium transition-all ${platform===p?"text-white":""}`}
              style={{ backgroundColor: platform===p?PLATFORM_CONFIG[p].color:"var(--bg-secondary)", color: platform===p?"#fff":"var(--text-secondary)" }}>
              {PLATFORM_CONFIG[p].icon} {PLATFORM_CONFIG[p].label}
            </button>
          ))}
        </div>

        {/* Instructions */}
        <div className="mb-4 rounded-lg p-3 text-xs" style={{ backgroundColor: platform==="twitter"?"#E3F2FD":platform==="facebook"?"#E8EAF6":"#FCE4EC", color: platform==="twitter"?"#0D47A1":platform==="facebook"?"#1A237E":"#880E4F" }}>
          <p className="font-semibold">📥 How to download your {pc.label} history:</p>
          <p className="mt-1 opacity-80 whitespace-pre-line">{pc.instructions}</p>
          <p className="mt-2 font-medium">{pc.what}</p>
        </div>

        {/* Drop zone */}
        <div className="mb-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors"
          style={{ borderColor: file ? pc.color : "var(--border)" }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]!); }}>
          <span className="text-3xl">{pc.icon}</span>
          <p className="mt-2 text-sm">Drop ZIP file here</p>
          <label className="mt-2 cursor-pointer text-xs underline" style={{ color: "#9b59b6" }}>
            or browse
            <input type="file" accept=".zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}/>
          </label>
        </div>

        {file && (
          <>
            <div className="mb-3 space-y-1 text-xs">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={importPosts} onChange={e=>setImportPosts(e.target.checked)} style={{accentColor:"#9b59b6"}}/>Posts/Tweets</label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={importComments} onChange={e=>setImportComments(e.target.checked)} style={{accentColor:"#9b59b6"}}/>Comments</label>
            </div>
            <div className="mb-4 rounded-md border p-3" style={{ borderColor: "#4CAF50", backgroundColor: "#E8F5E9" }}>
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "#2E7D32" }}><CheckCircle size={14}/>{count} elements found</div>
            </div>
            <button onClick={handleImport} disabled={importing}
              className="flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium text-white hover:opacity-90 min-touch" style={{ backgroundColor: "#9b59b6" }}>
              {importing ? <><Loader2 size={14} className="animate-spin"/>{progress||"Importing..."}</> : <><Download size={14}/> Process and import</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
export default SocialExportImporter;
