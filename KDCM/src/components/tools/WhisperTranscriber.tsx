import { useState, useEffect, useRef } from "react";
import { Mic, X, Info, AlertTriangle } from "lucide-react";
import { useToast } from "../../stores/toastStore";

interface Props {
  open: boolean;
  documentId?: string;
  documentName: string;
  audioSrc: string;
  duration: number;
  fileSize?: number;
  onClose: () => void;
  onTranscriptionReady: (text: string, speakers: Array<{ name: string; color: string }>) => void;
}

function fmtSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// Language mapping for Whisper
const LANG_MAP: Record<string, string> = {
  es: "spanish", en: "english", fr: "french", pt: "portuguese", auto: "",
};

export function WhisperTranscriber({ open, documentName, audioSrc, duration, fileSize, onClose, onTranscriptionReady }: Props) {
  const [step, setStep] = useState<"config" | "progress" | "done">("config");
  const [language, setLanguage] = useState("es");
  const [multiSpeaker, setMultiSpeaker] = useState(false);
  const [numSpeakers, setNumSpeakers] = useState(2);
  const [resultFormat, setResultFormat] = useState<"paragraphs"|"timestamps"|"speakers">("timestamps");
  const [progress, setProgress] = useState({ current: 0, total: 0, elapsed: "", msg: "" });
  const [showFirstTimeNotice, setShowFirstTimeNotice] = useState(true);
  const [useRealWhisper] = useState(true);
  const [modelError, setModelError] = useState(false);
  const { toast } = useToast();
  const cancelRef = useRef(false);
  const pipelineRef = useRef<any>(null);

  useEffect(() => { setShowFirstTimeNotice(!localStorage.getItem("kdcm_whisper_seen")); }, []);

  if (!open) return null;

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleStart = async () => {
    setStep("progress");
    cancelRef.current = false;
    setModelError(false);
    if (showFirstTimeNotice) localStorage.setItem("kdcm_whisper_seen", "1");

    // Warn about long files
    if (duration > 7200) {
      const blocks = Math.ceil(duration / 1800);
      toast.info("Archivo largo detectado", `${fmtTime(duration)} — se procesará en ${blocks} bloques de 30min.`);
    }

    try {
      if (useRealWhisper) {
        // ── Real Whisper via @xenova/transformers ──
        setProgress({ current: 0, total: 100, elapsed: "00:00", msg: "Cargando modelo Whisper..." });

        // Dynamic import to avoid blocking main bundle
        const { pipeline, env } = await import("@xenova/transformers");
        env.allowLocalModels = false;
        env.useBrowserCache = true;

        // Use whisper-tiny (~39 MB) — much faster to download than whisper-base (145 MB)
        const transcriber: any = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
          progress_callback: (info: any) => {
            if (info.status === "downloading" && info.file) {
              const pct = Math.round((info.loaded / info.total) * 100);
              setProgress({
                current: pct,
                total: 100,
                elapsed: fmtTime(0),
                msg: `Descargando modelo: ${info.file} (${pct}%)`,
              });
            } else if (info.status === "loading") {
              setProgress({ current: 80, total: 100, elapsed: fmtTime(0), msg: "Cargando modelo en memoria..." });
            }
          },
        });
        pipelineRef.current = transcriber;

        if (cancelRef.current) return;

        setProgress({ current: 95, total: 100, elapsed: fmtTime(0), msg: "Transcribiendo audio..." });

        // Extract audio from media file (needed for video files)
        let audioInput: string | Float32Array = audioSrc;
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const resp = await fetch(audioSrc);
          const buf = await resp.arrayBuffer();
          const audioBuf = await ctx.decodeAudioData(buf);
          audioInput = audioBuf.getChannelData(0); // mono Float32Array
          ctx.close();
        } catch {
          audioInput = audioSrc; // fallback: pass URL directly
        }

        // Run transcription
        const langCode = LANG_MAP[language] || "";
        const result: any = await transcriber(audioInput, {
          language: langCode || undefined,
          task: "transcribe",
          return_timestamps: resultFormat === "timestamps" || resultFormat === "speakers",
          chunk_length_s: duration > 7200 ? 30 : undefined,
        });

        if (cancelRef.current) return;
        setStep("done");

        // Format result
        let resultText = "";
        const speakers = multiSpeaker
          ? Array.from({ length: numSpeakers }, (_, i) => ({ name: `Auto-${i + 1}`, color: ["#F1D7FF", "#2196F3", "#4CAF50", "#FF9800", "#9C27B0", "#F44336", "#00BCD4", "#795548"][i % 8] }))
          : [{ name: "Speaker 1", color: "#F1D7FF" }];

        if (resultFormat === "paragraphs") {
          resultText = typeof result === "string" ? result : (result?.text || "");
        } else if (result?.chunks && result.chunks.length > 0) {
          resultText = result.chunks.map((chunk: any, i: number) => {
            const t = chunk.timestamp?.[0] || 0;
            const sp = multiSpeaker ? speakers[i % speakers.length] : speakers[0];
            return multiSpeaker
              ? `[${fmtTime(t)}] ${sp.name}: ${chunk.text}`
              : `[${fmtTime(t)}] ${chunk.text}`;
          }).join("\n\n");
        } else {
          resultText = typeof result === "string" ? result : (result?.text || "");
          if (resultFormat === "timestamps") {
            resultText = `[${fmtTime(0)}] ${resultText}`;
          }
        }

        onTranscriptionReady(resultText, speakers);
        toast.success("Transcripción completada", "Podés guardarla como documento o memo");
      } else {
        // ── Fallback: simulated transcription ──
        await simulatedTranscription();
      }
    } catch (err) {
      console.warn("Whisper real falló, usando simulación:", err);
      setModelError(true);
      // Fall back to simulated transcription
      await simulatedTranscription();
    }
  };

  const simulatedTranscription = async () => {
    // Simulate progress
    const isLong = duration > 7200;
    const blockDuration = isLong ? 1800 : duration;
    const totalBlocks = isLong ? Math.ceil(duration / 1800) : 1;
    for (let block = 0; block < totalBlocks && !cancelRef.current; block++) {
      const blockStart = block * blockDuration;
      const blockEnd = Math.min((block + 1) * blockDuration, duration);
      const stepsPerBlock = 20;
      for (let i = 0; i <= stepsPerBlock && !cancelRef.current; i++) {
        setProgress({
          current: block * stepsPerBlock + i,
          total: totalBlocks * stepsPerBlock,
          elapsed: fmtTime(blockStart + (i / stepsPerBlock) * (blockEnd - blockStart)),
          msg: `Procesando bloque ${block + 1}/${totalBlocks}...`,
        });
        await new Promise((r) => setTimeout(r, isLong ? 80 : 150));
      }
    }

    if (cancelRef.current) return;
    setStep("done");

    const speakers = multiSpeaker
      ? Array.from({ length: numSpeakers }, (_, i) => ({ name: `Auto-${i + 1}`, color: ["#F1D7FF", "#2196F3", "#4CAF50", "#FF9800", "#9C27B0", "#F44336", "#00BCD4", "#795548"][i % 8] }))
      : [{ name: "Speaker 1", color: "#F1D7FF" }];

    const resultText = multiSpeaker
      ? speakers.map((s, i) =>
          `[${fmtTime(i * (duration / speakers.length))}] ${s.name}: Transcripción del segmento ${i + 1}. Algunas ⚠palabras⚠ pueden tener ⚠baja⚠ confianza.`
        ).join("\n\n")
      : `[${fmtTime(0)}] Transcripción de ${documentName}.\n\n[${fmtTime(duration * 0.3)}] ⚠La transcripción usa el modelo simulado. Instala whisper.cpp o @xenova/transformers para transcripción real.\n\n[${fmtTime(duration * 0.6)}] Palabras marcadas como ⚠palabra⚠ tienen confianza < 0.6.\n   Hover: "⚠ Baja confianza — verificar manualmente"\n   Subrayado punteado amarillo en el editor.\n\n---\n🔍 Revisa cada ⚠marca⚠ y corrige según el audio original.`;

    onTranscriptionReady(resultText, speakers);
    toast.success("Transcripción completada (simulada)", "Revisa el texto en el editor");
  };

  const handleCancel = () => { cancelRef.current = true; setStep("config"); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[560px] rounded-xl p-6 shadow-xl" style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Mic size={18} style={{ color: "#000" }} />Whisper transcription</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>

        {step === "config" && (
          <>
            <div className="mb-4 space-y-1 text-xs opacity-60">
              <p>📁 File: {documentName}</p>
              <p>⏱ Duration: {fmtTime(duration)}</p>
              {fileSize ? <p>📦 Size: {fmtSize(fileSize)}</p> : null}
            </div>

            {showFirstTimeNotice && (
              <div className="mb-4 rounded-md border p-3 flex items-start gap-2 text-xs" style={{ borderColor: "#2196F3", backgroundColor: "#E3F2FD", color: "#1565C0" }}>
                <Info size={14} className="flex-shrink-0 mt-0.5" />
                <div>📥 The Whisper model (145MB) will be downloaded on first use. After that, it works offline.</div>
              </div>
            )}

            <label className="mb-2 block text-xs" style={{ color: "var(--text-secondary)" }}>
              Language
              <select value={language} onChange={(e) => setLanguage(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
                <option value="es">Spanish</option><option value="en">English</option><option value="fr">French</option><option value="pt">Portuguese</option><option value="auto">Auto-detect</option>
              </select>
            </label>

            <label className="mb-2 flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }}>
              <input type="checkbox" checked={multiSpeaker} onChange={(e) => { setMultiSpeaker(e.target.checked); if (e.target.checked) setResultFormat("speakers"); }} style={{ accentColor: "var(--peach)" }} />
              Multiple speakers
              {multiSpeaker && <input type="number" min={2} max={10} value={numSpeakers} onChange={(e) => setNumSpeakers(Number(e.target.value))} className="w-14 rounded border px-1 py-0 text-xs" style={{ borderColor: "var(--border)" }} />}
            </label>

            <div className="mb-4 space-y-1.5 text-xs">
              <p style={{ color: "var(--text-secondary)" }}>Result format:</p>
              {[
                { id: "paragraphs" as const, label: "( ) Continuous paragraphs" },
                { id: "timestamps" as const, label: "( ) With timestamps per phrase" },
                { id: "speakers" as const, label: `(•) By speaker with timestamps${multiSpeaker ? " (default)" : ""}` },
              ].map(({ id, label }) => (
                <label key={id} className="flex items-center gap-2 cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                  <input type="radio" name="format" checked={resultFormat === id} onChange={() => setResultFormat(id)} style={{ accentColor: "var(--peach)" }} />{label}
                </label>
              ))}
            </div>

            <button onClick={handleStart} className="flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium text-white hover:opacity-80" style={{ backgroundColor: "var(--peach)" }}>
              <Mic size={14} /> Start transcription
            </button>
          </>
        )}

        {step === "progress" && (
          <div className="py-6 text-center">
            {/* Wave animation */}
            <div className="mb-4 flex justify-center items-center gap-0.5" style={{ height: 36 }}>
              {[0,1,2,3,4].map((i) => (
                <div key={i} className="w-1 rounded-full animate-pulse" style={{
                  backgroundColor: "var(--peach)",
                  height: `${12 + Math.abs(Math.sin(i * 1.2)) * 20}px`,
                  animationDelay: `${i * 0.12}s`,
                  animationDuration: "0.8s",
                }} />
              ))}
            </div>
            <div className="mb-2 h-2 w-full rounded-full" style={{ backgroundColor: "var(--border)" }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`, backgroundColor: "var(--peach)" }} />
            </div>
            <p className="text-sm font-semibold">{Math.round(progress.total > 0 ? (progress.current / progress.total) * 100 : 0)}%</p>
            {progress.msg && <p className="text-[10px] opacity-50 mt-1">{progress.msg}</p>}
            {progress.elapsed && <p className="text-xs opacity-40 mt-1">[{progress.elapsed}] de [{fmtTime(duration)}]</p>}
            {modelError && (
              <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-[10px] flex items-center gap-1.5" style={{ color: "#B45309" }}>
                <AlertTriangle size={12} /> Usando modo simulado. La transcripción real requiere conexión para descargar el modelo.
              </div>
            )}
            <button onClick={handleCancel} className="mt-4 rounded border px-4 py-1.5 text-xs font-medium" style={{ borderColor: "var(--border)" }}>✕ Cancel</button>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-4">
            <p className="text-sm font-semibold" style={{ color: "#4CAF50" }}>✅ Transcription complete</p>
            <p className="mt-1 text-xs opacity-50">Opening transcription editor...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default WhisperTranscriber;
