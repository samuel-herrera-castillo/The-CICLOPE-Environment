import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, Square, Save, X, Volume2, Gauge } from "lucide-react";
import { useToast } from "../../stores/toastStore";

/* ── Types ── */

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const LANGS = [
  { code: "es-ES", label: "Español", flag: "🇪🇸" },
  { code: "en-US", label: "English", flag: "🇺🇸" },
  { code: "fr-FR", label: "Français", flag: "🇫🇷" },
  { code: "pt-BR", label: "Português", flag: "🇧🇷" },
];

interface Props {
  open: boolean;
  text: string;
  onClose: () => void;
}

export function TTSPanel({ open, text, onClose }: Props) {
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(0.8);
  const [lang, setLang] = useState("es-ES");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const wordIdxRef = useRef(0);
  const [activeWord, setActiveWord] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const loadVoices = () => {
      const v = speechSynthesis.getVoices();
      setVoices(v);
      if (v.length > 0) {
        const esVoice = v.find((vo) => vo.lang.startsWith("es"));
        setSelectedVoice(esVoice ?? v[0]);
      }
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
    return () => { speechSynthesis.cancel(); };
  }, []);

  useEffect(() => {
    if (!open) { speechSynthesis.cancel(); setPlaying(false); }
  }, [open]);

  const speak = useCallback(() => {
    if (!text) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    utterance.lang = lang;
    if (selectedVoice) utterance.voice = selectedVoice;

    // Track word position
    utterance.onboundary = (e) => {
      if (e.charIndex !== undefined) {
        const before = text.slice(0, e.charIndex);
        const words = before.split(/\s+/);
        wordIdxRef.current = words.length;
        const wordAt = text.slice(e.charIndex, e.charIndex + (e.charLength ?? 5)).split(/\s+/)[0];
        setActiveWord(wordAt ?? "");
      }
    };

    utterance.onend = () => { setPlaying(false); setActiveWord(""); };
    utterance.onerror = () => { setPlaying(false); toast.info("TTS", "Playback stopped"); };

    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
    setPlaying(true);
  }, [text, rate, pitch, volume, lang, selectedVoice, toast]);

  const pause = () => { speechSynthesis.pause(); setPlaying(false); };
  const resume = () => { speechSynthesis.resume(); setPlaying(true); };
  const stop = () => { speechSynthesis.cancel(); setPlaying(false); setActiveWord(""); };

  const saveAsMP3 = async () => {
    toast.info("Save MP3", "MediaRecorder API would save audio as MP3");
  };

  if (!open) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[350] animate-slide-up"
      style={{
        backgroundColor: "#1E2028", borderRadius: "12px 12px 0 0",
        height: 56, boxShadow: "0 -4px 20px rgba(0,0,0,0.3)",
      }}
    >
      <div className="flex items-center h-full px-4 gap-3">
        {/* Play/Pause/Stop */}
        <button
          onClick={playing ? pause : playing === false && utteranceRef.current ? resume : speak}
          className="flex-shrink-0 rounded-full w-9 h-9 flex items-center justify-center bg-peach-500 hover:bg-peach-700 text-white"
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button onClick={stop} className="flex-shrink-0 rounded-full p-1 hover:bg-white/10" title="Stop">
          <Square size={14} color="#aaa" />
        </button>

        {/* Active word preview */}
        <div className="flex-1 min-w-0 truncate text-sm text-white/60 font-mono max-w-[200px]">
          {activeWord || (playing ? "..." : text.slice(0, 60))}
        </div>

        {/* Rate chips */}
        <div className="flex items-center gap-0.5">
          {RATES.map((r) => (
            <button key={r} onClick={() => { setRate(r); if (playing) { stop(); setTimeout(() => speak(), 100); } }}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium min-touch ${
                rate === r ? "bg-peach-500 text-white" : "text-white/50 hover:text-white hover:bg-white/10"
              }`}>
              {r}x
            </button>
          ))}
        </div>

        {/* Pitch slider */}
        <div className="flex items-center gap-1" title="Pitch">
          <Gauge size={12} color="#888" />
          <input type="range" min={0.5} max={2} step={0.1} value={pitch}
            onChange={(e) => setPitch(Number(e.target.value))}
            className="w-16" style={{ accentColor: "var(--peach)" }} />
        </div>

        {/* Volume */}
        <div className="flex items-center gap-1" title="Volume">
          <Volume2 size={12} color="#888" />
          <input type="range" min={0} max={1} step={0.1} value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-16" style={{ accentColor: "var(--peach)" }} />
        </div>

        {/* Language */}
        <select value={lang} onChange={(e) => setLang(e.target.value)}
          className="bg-transparent text-white/70 text-[10px] border border-white/20 rounded px-1.5 py-1 outline-none">
          {LANGS.map((l) => (
            <option key={l.code} value={l.code} style={{ backgroundColor: "#1E2028" }}>{l.flag} {l.label}</option>
          ))}
        </select>

        {/* Voice selector */}
        <select value={selectedVoice?.name ?? ""} onChange={(e) => {
          const v = voices.find((vo) => vo.name === e.target.value);
          if (v) setSelectedVoice(v);
        }}
          className="bg-transparent text-white/50 text-[10px] border border-white/20 rounded px-1.5 py-1 outline-none max-w-[120px] truncate">
          {voices.filter((v) => v.lang.startsWith(lang.split("-")[0])).map((v) => (
            <option key={v.name} value={v.name} style={{ backgroundColor: "#1E2028" }}>{v.name}</option>
          ))}
        </select>

        {/* Save MP3 */}
        <button onClick={saveAsMP3}
          className="rounded p-1.5 hover:bg-white/10 flex-shrink-0" title="Save as MP3">
          <Save size={14} color="#aaa" />
        </button>

        {/* Close */}
        <button onClick={onClose} className="rounded p-1.5 hover:bg-white/10 flex-shrink-0">
          <X size={14} color="#aaa" />
        </button>
      </div>
    </div>
  );
}

export default TTSPanel;
