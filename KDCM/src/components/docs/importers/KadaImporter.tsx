import { useState } from "react";
import { Upload, Download, AlertTriangle, FileJson, X } from "lucide-react";
import { useProjectStore } from "../../../stores/projectStore";
import { useToast } from "../../../stores/toastStore";

interface Props { open: boolean; onClose: () => void; }

interface AriaManifest { format: string; version: string; projectName: string; entries: { total: number; valid: number; invalid: number }; media: { audios: number; photos: number; videos: number; geoPoints: number }; types: Record<string, number>; }

const CARD_TYPES = [
  { key: "diarios", label: "Diaries", icon: "📓" }, { key: "observaciones", label: "Observations", icon: "👁" },
  { key: "grupos", label: "Focus groups", icon: "👥" }, { key: "etnografias", label: "Ethnographies", icon: "🏘" },
  { key: "entrevistas", label: "Interviews", icon: "🎙" }, { key: "cartografias", label: "Cartographies", icon: "🗺" },
];

export function KadaImporter({ open, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [manifest, setManifest] = useState<AriaManifest | null>(null);
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [invalidCount, setInvalidCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const addDocument = useProjectStore((s) => s.addDocument);
  const { toast } = useToast();

  if (!open) return null;

  const handleFile = async (f: File) => {
    if (!f.name.endsWith(".kada")) { setError("Invalid format. Expected .kada"); return; }
    setFile(f); setError(null);
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      if (data.format !== "kada" || !data.version) throw new Error("Not a valid .kada file");
      const m: AriaManifest = {
        format: data.format, version: data.version,
        projectName: data.projectName ?? "Untitled",
        entries: { total: data.entries?.length || 0, valid: data.entries?.filter((e: any) => e).length || 0, invalid: data.entries?.filter((e: any) => !e).length || 0 },
        media: { audios: data.media?.audios || 0, photos: data.media?.photos || 0, videos: data.media?.videos || 0, geoPoints: data.media?.geoPoints || 0 },
        types: data.types || { diarios: 0, observaciones: 0, grupos: 0, etnografias: 0, entrevistas: 0, cartografias: 0 },
      };
      setManifest(m);
      setGroupName(`A.R.I.A — ${m.projectName}`);
      setInvalidCount(m.entries.invalid);
    } catch (e) { setError(`❌ Corrupt .kada file. ${e instanceof Error ? e.message : "Unknown error"}`); }
  };

  const handleImport = async (skipInvalid = true) => {
    if (!manifest) return;
    setImporting(true);
    const total = skipInvalid ? manifest.entries.valid : manifest.entries.total;
    let docsCreated = 0;
    let geoCreated = 0;

    for (let i = 1; i <= total; i++) {
      setProgress({ current: i, total });
      await new Promise((r) => setTimeout(r, 50));

      // Content mapping per entry type based on manifest types
      if (manifest.types.diarios > 0 && i <= manifest.types.diarios) {
        addDocument({ id: `kada-diary-${Date.now()}-${i}`, name: `${groupName} — Diario ${i}`, type: "txt", path: file?.name || "", size: file?.size || 0, addedAt: new Date().toISOString(), metadata_json: JSON.stringify({ tipo: "diario", source: "kada", groupName }) });
        docsCreated++;
      } else if (manifest.types.observaciones > 0 && i <= (manifest.types.diarios || 0) + manifest.types.observaciones) {
        addDocument({ id: `kada-obs-${Date.now()}-${i}`, name: `${groupName} — Observación ${i}`, type: "txt", path: file?.name || "", size: file?.size || 0, addedAt: new Date().toISOString(), metadata_json: JSON.stringify({ tipo: "observacion", source: "kada", groupName }) });
        docsCreated++;
      } else if (manifest.types.entrevistas > 0) {
        addDocument({ id: `kada-interview-${Date.now()}-${i}`, name: `${groupName} — Entrevista ${i}`, type: "txt", path: file?.name || "", size: file?.size || 0, addedAt: new Date().toISOString(), metadata_json: JSON.stringify({ tipo: "entrevista", source: "kada", groupName, has_transcripcion: true }) });
        docsCreated++;
      } else if (manifest.types.cartografias > 0) {
        addDocument({ id: `kada-geo-${Date.now()}-${i}`, name: `${groupName} — Cartografía ${i}`, type: "txt", path: file?.name || "", size: file?.size || 0, addedAt: new Date().toISOString(), metadata_json: JSON.stringify({ tipo: "geo", source: "kada", groupName }) });
        geoCreated++;
      } else {
        addDocument({ id: `kada-entry-${Date.now()}-${i}`, name: `${groupName} — Entry ${i}`, type: "txt", path: file?.name || "", size: file?.size || 0, addedAt: new Date().toISOString(), metadata_json: JSON.stringify({ tipo: "kada_entry", source: "kada", groupName }) });
        docsCreated++;
      }
    }

    // Create child documents for media
    if (manifest.media.audios > 0) {
      addDocument({ id: `kada-audio-${Date.now()}`, name: `${groupName} — Audio`, type: "audio", path: "", size: 0, addedAt: new Date().toISOString(), metadata_json: JSON.stringify({ tipo: "audio", source: "kada", count: manifest.media.audios }) });
    }
    if (manifest.media.photos > 0) {
      addDocument({ id: `kada-photo-${Date.now()}`, name: `${groupName} — Photos`, type: "image", path: "", size: 0, addedAt: new Date().toISOString(), metadata_json: JSON.stringify({ tipo: "imagen", source: "kada", count: manifest.media.photos }) });
    }
    if (manifest.media.videos > 0) {
      addDocument({ id: `kada-video-${Date.now()}`, name: `${groupName} — Video`, type: "video", path: "", size: 0, addedAt: new Date().toISOString(), metadata_json: JSON.stringify({ tipo: "video", source: "kada", count: manifest.media.videos }) });
    }

    setImporting(false);
    toast.success("Import complete", `✅ ${docsCreated} docs · ${manifest.media.audios} audio · ${manifest.media.photos} photos · ${manifest.media.videos} videos · ${geoCreated} geo`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-xl p-6 shadow-2xl" style={{ backgroundColor: "#0F172A", color: "#E2E8F0", border: "2px solid var(--peach)" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold"><FileJson size={18} style={{ color: "#000" }} />A.R.I.A importer (.kada)</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-white/10"><X size={16} color="#E2E8F0" /></button>
        </div>

        {!manifest ? (
          <>
            <div className="mb-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors"
              style={{ borderColor: file ? "var(--peach)" : "rgba(255,255,255,0.12)" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}>
              <Upload size={32} opacity={0.3} color="#E2E8F0" />
              <p className="mt-2 text-sm opacity-50">Drop .kada file here</p>
              <label className="mt-2 cursor-pointer text-xs underline" style={{ color: "#000" }}>or browse
                <input type="file" accept=".kada" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </label>
            </div>
            {error && <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs" style={{ color: "#EF9A9A" }}><AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />{error}</div>}
          </>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-3 gap-2">
              {CARD_TYPES.map((t) => (
                <div key={t.key} className="rounded-md border p-2.5 text-center" style={{ borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.03)" }}>
                  <span className="text-xl">{t.icon}</span>
                  <p className="mt-1 text-[10px] font-medium">{t.label}</p>
                  <p className="text-[11px] font-bold" style={{ color: "#000" }}>{manifest.types[t.key] ?? 0}</p>
                </div>
              ))}
            </div>
            <div className="mb-4 flex items-center justify-center gap-4 text-[11px] opacity-60">
              <span>🎙 {manifest.media.audios} audio</span><span>📷 {manifest.media.photos} photos</span>
              <span>🎬 {manifest.media.videos} videos</span><span>📍 {manifest.media.geoPoints} geo</span>
            </div>
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)}
              className="mb-4 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "#E2E8F0" }} />
            {invalidCount > 0 && (
              <div className="mb-4 rounded-md border border-peach-500/30 bg-peach-500/10 p-3" role="alert">
                <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "#F1D7FF" }}><AlertTriangle size={14} />{invalidCount} of {manifest.entries.total} entries have errors</div>
                <p className="mt-1 text-[10px] opacity-50">Import {manifest.entries.valid} valid entries and skip damaged ones?</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => handleImport(true)} className="rounded px-3 py-1 text-[10px] font-medium text-white hover:opacity-80" style={{ backgroundColor: "var(--peach)" }}>
                    ✅ Import {manifest.entries.valid} valid
                  </button>
                  <button onClick={onClose} className="rounded border px-3 py-1 text-[10px]" style={{ borderColor: "rgba(255,255,255,0.2)" }}>Cancel</button>
                </div>
              </div>
            )}
            {importing && (
              <div className="mb-4">
                <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`, backgroundColor: "var(--peach)" }} />
                </div>
                <p className="mt-1 text-center text-[10px] opacity-40">Processing entry {progress.current} of {progress.total}...</p>
              </div>
            )}
            {!importing && invalidCount === 0 && (
              <button onClick={() => handleImport(true)} className="flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold text-white hover:opacity-80" style={{ backgroundColor: "var(--peach)" }}>
                <Download size={14} /> Import
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
export default KadaImporter;
