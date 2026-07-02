import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Square, X } from "lucide-react";
import { useTTSStore, getTTSWordHighlightCallback, getTTSBoundaryCallback } from "../../stores/ttsStore";
import { useToast } from "../../stores/toastStore";

export function TTSPlayer() {
  const store = useTTSStore();
  const { toast } = useToast();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  const speak = useCallback(() => {
    if (!store.text) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(store.text);
    utter.lang = store.language;
    utter.rate = store.speed;
    utter.pitch = store.pitch;
    utter.volume = store.volume;
    if (store.voiceName) {
      const v = voices.find((v) => v.name === store.voiceName);
      if (v) utter.voice = v;
    }
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => { setIsSpeaking(false); setIsPaused(false); };
    utter.onerror = () => { setIsSpeaking(false); setIsPaused(false); };
    // Word boundary → highlight active word in viewer
    utter.onboundary = (e) => {
      if (e.name === "word") {
        const cb = getTTSWordHighlightCallback();
        if (cb) cb(e.charIndex);
        const bcb = getTTSBoundaryCallback();
        if (bcb) bcb(e.charIndex, e.charLength || 0);
      }
    };
    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [store.text, store.language, store.speed, store.pitch, store.volume, store.voiceName, voices]);

  const pause = () => { window.speechSynthesis.pause(); setIsPaused(true); };
  const resume = () => { window.speechSynthesis.resume(); setIsPaused(false); };

  if (!store.isOpen) return null;

  const filteredVoices = voices.filter((v) => v.lang.startsWith(store.language.split("-")[0]));
  const previewText = store.text ? store.text.slice(0, 100) + (store.text.length > 100 ? "..." : "") : "";

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 shadow-xl"
      style={{
        backgroundColor: "#1E2028",
        color: "#E2E8F0",
        borderRadius: "12px 12px 0 0",
        animation: "kdcm-slide-up 200ms ease-out",
      }}
    >
      <style>{`@keyframes kdcm-slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      <div className="flex items-center gap-3 px-4" style={{ height: 56 }}>
        {/* ▶/⏸ 36px */}
        <button onClick={isPaused ? resume : isSpeaking ? pause : speak}
          className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-full text-white hover:opacity-80"
          style={{ backgroundColor: "var(--peach)" }}>
          {isPaused ? <Play size={18} /> : isSpeaking ? <Pause size={18} /> : <Play size={18} />}
        </button>
        {/* ⏹ 28px */}
        <button onClick={stop} className="flex h-[28px] w-[28px] flex-shrink-0 items-center justify-center rounded hover:bg-white/10"><Square size={14} /></button>

        {/* Preview 200px */}
        <div className="w-[200px] flex-shrink-0 overflow-hidden">
          <p className="text-[10px] truncate opacity-60">{previewText || "Select text to read"}</p>
        </div>

        {/* Speed chips */}
        <div className="flex items-center gap-0.5">
          {[0.5, 0.75, 1, 1.25, 1.5, 2].map((sp) => (
            <button key={sp} onClick={() => store.setSpeed(sp)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${store.speed === sp ? "" : "opacity-40 hover:opacity-70"}`}
              style={{ backgroundColor: store.speed === sp ? "var(--peach)" : "transparent", color: store.speed === sp ? "#1a1a1a" : "#E2E8F0" }}>
              {sp}x{sp === 1 ? "●" : ""}
            </button>
          ))}
        </div>

        {/* Tono ↓ slider ↑ */}
        <span className="text-[9px] opacity-40 flex-shrink-0">↓</span>
        <input type="range" min="0.5" max="2" step="0.1" value={store.pitch} onChange={(e) => store.setPitch(parseFloat(e.target.value))}
          className="w-12 flex-shrink-0" title="Tono" style={{ accentColor: "var(--peach)" }} />
        <span className="text-[9px] opacity-40 flex-shrink-0">↑</span>

        {/* 🔊 slider volumen */}
        <span className="text-[10px] opacity-40 flex-shrink-0">🔊</span>
        <input type="range" min="0" max="1" step="0.1" value={store.volume} onChange={(e) => store.setVolume(parseFloat(e.target.value))}
          className="w-12 flex-shrink-0" title="Volumen" style={{ accentColor: "var(--peach)" }} />

        {/* Idioma ▼ */}
        <select value={store.language} onChange={(e) => store.setLanguage(e.target.value)}
          className="rounded border bg-transparent px-1 py-0.5 text-[10px] flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.2)", color: "#E2E8F0" }}>
          <option value="es-ES">ES</option><option value="en-US">EN</option><option value="fr-FR">FR</option><option value="pt-BR">PT</option>
        </select>

        {/* Voz sistema ▼ */}
        <select value={store.voiceName || ""} onChange={(e) => store.setVoiceName(e.target.value || null)}
          className="rounded border bg-transparent px-1 py-0.5 text-[10px] max-w-[120px] flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.2)", color: "#E2E8F0" }}>
          <option value="">System</option>
          {filteredVoices.map((v) => <option key={v.name} value={v.name}>{v.name.slice(0, 20)}</option>)}
        </select>

        {/* 💾 Guardar MP3 */}
        <button onClick={() => {
          if (!store.text) return;
          const baseName = store.text.slice(0, 40).replace(/[^a-zA-Z0-9áéíóúñ ]/g, "").trim() || "kdcm";
          if (typeof MediaRecorder === "undefined") {
            toast.warning("⚠ Tu navegador no soporta la grabación", "Guardando como archivo de texto");
            const blob = new Blob([store.text], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `${baseName}_lectura.txt`; a.click();
            URL.revokeObjectURL(url);
            return;
          }
          try {
            const audioCtx = new AudioContext();
            const dest = audioCtx.createMediaStreamDestination();
            const recorder = new MediaRecorder(dest.stream);
            const chunks: BlobPart[] = [];
            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = () => {
              const blob = new Blob(chunks, { type: "audio/webm" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `${baseName}_lectura.webm`; a.click();
              URL.revokeObjectURL(url);
              audioCtx.close();
              toast.success("Audio guardado", `${baseName}_lectura.webm`);
            };
            recorder.start();
            const estimatedSecs = Math.max(3, Math.min(60, store.text.length / 12));
            setTimeout(() => { recorder.stop(); }, estimatedSecs * 1000);
            const utter = new SpeechSynthesisUtterance(store.text.slice(0, 200));
            utter.rate = store.speed; utter.pitch = store.pitch; utter.volume = store.volume;
            window.speechSynthesis.speak(utter);
          } catch {
            toast.warning("No se pudo grabar audio", "Guardando como archivo de texto");
            const blob = new Blob([store.text], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `${baseName}_lectura.txt`; a.click();
            URL.revokeObjectURL(url);
          }
        }} className="flex h-7 flex-shrink-0 items-center gap-1 rounded px-2 text-[10px] font-medium hover:bg-white/10" title="Guardar como MP3">
          💾 MP3
        </button>

        {/* ✕ Cerrar */}
        <button onClick={store.close} className="flex h-[28px] w-[28px] flex-shrink-0 items-center justify-center rounded hover:bg-white/10"><X size={14} /></button>
      </div>
    </div>
  );
}

export function useTTS() {
  const store = useTTSStore();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const speak = useCallback((text: string) => {
    window.speechSynthesis.cancel();
    store.open(text);
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = store.language;
    utter.rate = store.speed;
    utter.pitch = store.pitch;
    utter.volume = store.volume;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => { setIsSpeaking(false); setIsPaused(false); store.close(); };
    utter.onerror = () => { setIsSpeaking(false); store.close(); };
    window.speechSynthesis.speak(utter);
  }, [store]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    store.close();
  }, [store]);

  return { speak, stop, pause: () => { window.speechSynthesis.pause(); setIsPaused(true); }, resume: () => { window.speechSynthesis.resume(); setIsPaused(false); }, isSpeaking, isPaused };
}

export default TTSPlayer;
