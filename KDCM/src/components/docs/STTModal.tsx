import { useState, useEffect, useRef } from "react";
import { X, Mic, Square, Download, AlertTriangle } from "lucide-react";
import { useToast } from "../../stores/toastStore";

interface Props { open: boolean; onClose: () => void; }

type FormatType = "paragraphs" | "timestamps" | "speaker-timestamps";

const LANGS = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "pt", label: "Português" },
  { code: "auto", label: "Detectar automático" },
];

export function STTModal({ open, onClose }: Props) {
  const [step, setStep] = useState<"config" | "progress" | "result">("config");
  const [, _setName] = useState("");
  const [, _setDuration] = useState("");
  const [, _setSize] = useState("");
  const [lang, setLang] = useState("es");
  const [multiSpeaker, setMultiSpeaker] = useState(false);
  const [speakerCount, setSpeakerCount] = useState(2);
  const [format, setFormat] = useState<FormatType>("speaker-timestamps");
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState("00:00:00");
  const [transcript, setTranscript] = useState("");
  const [speakers, setSpeakers] = useState<{ id: string; name: string }[]>([
    { id: "auto-1", name: "Auto-1" }, { id: "auto-2", name: "Auto-2" },
  ]);
  const [lowConfWords] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) { setStep("config"); setProgress(0); setTranscript(""); }
  }, [open]);

  const startTranscription = () => {
    setStep("progress");
    setProgress(0);
    let p = 0;
    intervalRef.current = setInterval(() => {
      p += 10;
      if (p >= 100) {
        p = 100;
        if (intervalRef.current) clearInterval(intervalRef.current);
        setTranscript("");
        setStep("result");
        toast.success("Complete", "Transcription finished");
      }
      setProgress(Math.min(100, Math.round(p)));
      const secs = Math.floor((p / 100) * 222);
      const m = Math.floor(secs / 60), s = secs % 60;
      setElapsed(`00:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }, 500);
  };

  const cancelProcess = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStep("config");
    setProgress(0);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-[560px] rounded-xl shadow-2xl"
        style={{ backgroundColor: "var(--bg-panel)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
            🎙 Speech to Text
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>

        <div className="p-5">
          {/* STEP: Config */}
          {step === "config" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] opacity-40 mb-0.5">Name</label>
                  <div className="rounded border px-3 py-2 opacity-50" style={{ borderColor: "var(--border)" }}>Interview_03.mp3</div>
                </div>
                <div>
                  <label className="block text-[10px] opacity-40 mb-0.5">Duration</label>
                  <div className="rounded border px-3 py-2 opacity-50" style={{ borderColor: "var(--border)" }}>3:42</div>
                </div>
                <div>
                  <label className="block text-[10px] opacity-40 mb-0.5">Size</label>
                  <div className="rounded border px-3 py-2 opacity-50" style={{ borderColor: "var(--border)" }}>4.2 MB</div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-medium opacity-40 mb-1 uppercase">Language</label>
                <select value={lang} onChange={(e) => setLang(e.target.value)}
                  className="w-full rounded border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  {LANGS.map((l) => (<option key={l.code} value={l.code}>{l.label}</option>))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-primary)" }}>
                <input type="checkbox" checked={multiSpeaker} onChange={(e) => setMultiSpeaker(e.target.checked)}
                  style={{ accentColor: "var(--peach)" }} /> Multiple speakers
              </label>
              {multiSpeaker && (
                <div>
                  <label className="block text-[10px] opacity-40 mb-0.5">Expected speakers</label>
                  <select value={speakerCount} onChange={(e) => setSpeakerCount(Number(e.target.value))}
                    className="rounded border px-3 py-2 text-sm outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                    {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (<option key={n} value={n}>{n} speakers</option>))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-medium opacity-40 mb-1.5 uppercase">Format</label>
                <div className="space-y-1.5">
                  {[
                    { id: "paragraphs" as const, label: "Continuous paragraphs" },
                    { id: "timestamps" as const, label: "With timestamps" },
                    { id: "speaker-timestamps" as const, label: "By speaker with timestamps" },
                  ].map((f) => (
                    <label key={f.id} className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-primary)" }}>
                      <input type="radio" checked={format === f.id} onChange={() => setFormat(f.id)}
                        style={{ accentColor: "var(--peach)" }} /> {f.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Web download notice */}
              <div className="rounded-lg p-3 text-[10px]" style={{ backgroundColor: "#E3F2FD", color: "#1565C0" }}>
                💾 First time on web: 145MB model download via WebAssembly. Cached in IndexedDB for future use.
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={startTranscription}
                  className="flex items-center gap-2 rounded-md bg-peach-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-peach-700 min-touch">
                  <Mic size={14} /> Start transcription
                </button>
                <button onClick={onClose}
                  className="rounded-md border px-5 py-2.5 text-sm min-touch"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
              </div>
            </div>
          )}

          {/* STEP: Progress */}
          {step === "progress" && (
            <div className="space-y-5 text-center py-4">
              <div className="text-4xl animate-pulse">🎙</div>
              <div>
                <div className="h-3 rounded-full bg-gray-200 overflow-hidden mb-2">
                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: "var(--peach)" }} />
                </div>
                <p className="text-xs opacity-40">
                  {elapsed} of 00:03:42 — {progress}%
                </p>
              </div>
              <p className="text-[10px] opacity-20">Processing with Whisper.cpp · 145MB model</p>
              <button onClick={cancelProcess}
                className="rounded-md border px-4 py-2 text-xs min-touch"
                style={{ borderColor: "#F44336", color: "#F44336" }}>
                <Square size={12} className="inline mr-1" /> Cancel process
              </button>
            </div>
          )}

          {/* STEP: Result */}
          {step === "result" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Transcription result</span>
                  {lowConfWords.size > 0 && (
                    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: "#FFF9C4", color: "#F57F17" }}>
                      <AlertTriangle size={9} /> {lowConfWords.size} low confidence words
                    </span>
                  )}
                </div>
                <button onClick={() => toast.success("Saved", "Transcript saved to project")}
                  className="flex items-center gap-1 rounded bg-peach-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-peach-700 min-touch">
                  <Download size={11} /> Save transcript
                </button>
              </div>

              {/* Speakers editor */}
              <div className="flex items-center gap-2 flex-wrap">
                {speakers.map((sp) => (
                  <div key={sp.id} className="flex items-center gap-1">
                    <input value={sp.name}
                      onChange={(e) => setSpeakers((prev) => prev.map((s) => s.id === sp.id ? { ...s, name: e.target.value } : s))}
                      className="w-20 rounded border px-2 py-1 text-[10px] font-medium outline-none"
                      style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                  </div>
                ))}
              </div>

              {/* Transcript preview */}
              <div className="rounded-lg border p-4 max-h-[250px] overflow-y-auto font-mono text-xs leading-relaxed"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)" }}>
                {transcript.split("\n\n").map((line, i) => {
                  // Highlight low-confidence words
                  const parts = line.split(/(\s+)/);
                  return (
                    <p key={i} className="mb-1" style={{ color: "var(--text-primary)" }}>
                      {parts.map((word, j) => {
                        const cleanWord = word.replace(/[^\wáéíóúñü]/gi, "");
                        const isLow = lowConfWords.has(cleanWord.toLowerCase());
                        return (
                          <span key={j}
                            style={isLow ? {
                              borderBottom: "1.5px dotted #F57F17",
                              cursor: "help",
                            } : {}}
                            title={isLow ? "Low confidence" : undefined}>
                            {word}
                          </span>
                        );
                      })}
                    </p>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setStep("config"); setTranscript(""); }}
                  className="rounded-md border px-4 py-2 text-xs min-touch"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  ← New transcription
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default STTModal;
