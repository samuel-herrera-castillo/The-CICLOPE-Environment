import { useState, useCallback, useRef, useEffect } from "react";
import {
  Play, Pause, Scissors, ChevronDown, Plus, Save, Download, Trash2,
  Bold, Italic, Underline, Subscript,
  VolumeX, Pencil, X,
} from "lucide-react";
import type { ProjectDocument } from "../../stores/projectStore";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { saveTranscription as bridgeSaveTranscription } from "../../lib/tauriBridge";
import WaveSurfer from "wavesurfer.js";

/* ── Types ── */

interface Speaker {
  id: string;
  name: string;
  color: string;
}

interface TranscriptionEntry {
  id: string;
  timestamp: number;    // seconds
  speakerId: string;
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Markers for special spans: inaudible, SIC, etc. */
  markers?: { start: number; end: number; type: "inaudible" | "sic" | "double_sub" | "low_confidence" }[];
}

type ExportFormat = "txt" | "docx" | "srt" | "clipboard";

/* ── Helpers ── */

function fmtTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const SPEAKER_COLORS = [
  "#F1D7FF", "#2196F3", "#4CAF50", "#9C27B0", "#F1D7FF",
  "#00BCD4", "#F44336", "#3F51B5", "#009688", "#795548",
];

/* ══════════════════════════════════════════════════════
   Compact Audio Player (left 40%)
   ══════════════════════════════════════════════════════ */

function CompactPlayer({
  doc, currentTime, duration, playing, onPlayPause, onSeek, onSkip,
}: {
  doc: ProjectDocument;
  currentTime: number; duration: number; playing: boolean;
  onPlayPause: () => void; onSeek: (t: number) => void; onSkip: (s: number) => void;
}) {
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [wsReady, setWsReady] = useState(false);

  // Initialize WaveSurfer
  useEffect(() => {
    if (!waveformRef.current || wavesurferRef.current) return;
    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "rgba(241, 215, 255, 0.6)",
      progressColor: "#C4A0D4",
      cursorColor: "rgba(241, 215, 255, 0.9)",
      height: 80,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      backend: "WebAudio",
    });
    // Load actual audio if available, otherwise silent buffer
    if (doc.path && doc.path.startsWith("blob:")) {
      ws.load(doc.path);
    } else {
      ws.load("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
    }
    ws.on("ready", () => setWsReady(true));
    (ws as any).on("interaction", () => {
      const t = ws.getCurrentTime();
      if (typeof t === "number" && !isNaN(t)) onSeek(t);
    });
    wavesurferRef.current = ws;
    return () => { ws.destroy(); wavesurferRef.current = null; };
  }, []);

  // Sync play/pause
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws || !wsReady) return;
    if (playing) ws.play();
    else ws.pause();
  }, [playing, wsReady]);

  // Update progress marker
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws || !wsReady) return;
    const pct = duration > 0 ? currentTime / duration : 0;
    if (pct >= 0 && pct <= 1) (ws as any).setTime(pct * (ws.getDuration() || duration));
  }, [currentTime, duration, wsReady]);

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "#1E2028", color: "#E0E0E0" }}>
      {/* Info */}
      <div className="flex items-center gap-2 border-b px-3 py-2 text-xs" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <span className="font-medium truncate">{doc.name}</span>
        <span className="opacity-40">{fmtTimestamp(duration)}</span>
      </div>

      {/* WaveSurfer.js waveform */}
      <div
        ref={waveformRef}
        className="mx-3 mt-3 h-[80px] cursor-pointer rounded-md overflow-hidden"
        onWheel={(e) => {
          if (e.ctrlKey) {
            e.preventDefault();
            const ws = wavesurferRef.current;
            if (ws) {
              const newZoom = Math.max(1, Math.min(300, ws.options.minPxPerSec ? ws.options.minPxPerSec * (e.deltaY > 0 ? 0.5 : 2) : 50));
              ws.zoom(newZoom);
            }
          }
        }}
      />

      {/* Transport */}
      <div className="flex items-center justify-center gap-2 py-2">
        <button onClick={() => onSeek(0)} className="rounded p-1 hover:bg-white/10 text-[11px]" title="Start">⏮</button>
        <button onClick={() => onSkip(-5)} className="rounded p-1 hover:bg-white/10 text-[11px]">⏪ 5s</button>
        <button onClick={() => onSkip(-2)} className="rounded p-1 hover:bg-white/10 text-[11px]">⏪ 2s</button>
        <button
          onClick={onPlayPause}
          className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-peach-500 text-white hover:bg-peach-700"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <button onClick={() => onSkip(2)} className="rounded p-1 hover:bg-white/10 text-[11px]">2s ⏩</button>
        <button onClick={() => onSkip(5)} className="rounded p-1 hover:bg-white/10 text-[11px]">5s ⏩</button>
        <button onClick={() => onSeek(duration)} className="rounded p-1 hover:bg-white/10 text-[11px]" title="End">⏭</button>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 px-3 text-[10px] font-mono opacity-40">
        <span>{fmtTimestamp(currentTime)}</span>
        <div className="h-1 flex-1 rounded-full" style={{ backgroundColor: "#2D3F55" }}>
          <div className="h-full rounded-full" style={{ width: `${progressPct}%`, backgroundColor: "var(--peach)" }} />
        </div>
        <span>{fmtTimestamp(duration)}</span>
      </div>

      {/* Shortcut bar */}
      <div className="flex flex-wrap items-center gap-1 px-3 py-2 text-[10px]">
        {[
          { key: "F4", label: "⏱", hint: "Timestamp" },
          { key: "F5", label: "▶/⏸", hint: "Play/Pause" },
          { key: "F6", label: "⏪-5s", hint: "Rewind" },
          { key: "F7", label: "⏩+5s", hint: "Forward" },
          { key: "F8", label: "0.5×", hint: "Slow" },
          { key: "F9", label: "1.5×", hint: "Fast" },
        ].map((s) => (
          <span
            key={s.key}
            className="rounded border px-1.5 py-0.5 select-none"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11,
              backgroundColor: "rgba(255,255,255,0.05)",
              borderColor: "rgba(255,255,255,0.12)",
            }}
            title={s.hint}
          >
            <span className="opacity-40 mr-1">{s.key}</span>{s.label}
          </span>
        ))}
      </div>

      {/* Speed chips */}
      <div className="flex items-center gap-0.5 px-3 pb-2">
        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((sp) => (
          <button key={sp}
            onClick={() => {
              // Update speed — in real impl would change audio playback rate
              const el = document.querySelector("[data-speed-current]") as HTMLElement;
              if (el) el.textContent = `${sp}×`;
            }}
            className={`rounded px-1.5 py-0.5 text-[10px] font-mono transition-colors min-touch ${
              sp === 1 ? "bg-peach-500 text-white" : "text-white/50 hover:bg-white/10"
            }`}
          >
            {sp}×{sp === 1 ? "●" : ""}
          </button>
        ))}
        <span data-speed-current className="ml-2 text-[10px] opacity-40">1×</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Speaker panel
   ══════════════════════════════════════════════════════ */

function SpeakerPanel({
  speakers, activeId, onSelect, onAdd, suggestions = [],
}: {
  speakers: Speaker[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: (name: string) => void;
  suggestions?: string[];
}) {
  const [newName, setNewName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAdd && inputRef.current) inputRef.current.focus();
  }, [showAdd]);

  // Filter suggestions based on input
  const filtered = suggestions.filter((s) =>
    !newName.trim() || s.toLowerCase().includes(newName.toLowerCase())
  ).slice(0, 5);

  return (
    <div className="flex items-center gap-1.5 border-b px-3 py-1.5 overflow-x-auto" style={{ borderColor: "var(--border)" }}>
      {speakers.map((s) => {
        const isActive = s.id === activeId;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-[11px] font-medium transition-all min-touch whitespace-nowrap ${
              isActive ? "" : "opacity-60 hover:opacity-90"
            }`}
            style={{
              borderColor: isActive ? s.color : "transparent",
              backgroundColor: s.color + "18",
              color: "var(--text-primary)",
            }}
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </button>
        );
      })}

      {showAdd ? (
        <div className="relative flex items-center gap-1">
          <input
            ref={inputRef}
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) { onAdd(newName.trim()); setNewName(""); setShowAdd(false); setShowSuggestions(false); }
              if (e.key === "Escape") { setShowAdd(false); setNewName(""); setShowSuggestions(false); }
            }}
            placeholder="Speaker name"
            className="w-[120px] rounded-full border px-2.5 py-1 text-[11px] outline-none"
            style={{ borderColor: "var(--peach)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
          />
          <button onClick={() => { if (newName.trim()) { onAdd(newName.trim()); setNewName(""); setShowAdd(false); } }}
            className="rounded-full p-1 hover:bg-gray-100">
            <Plus size={14} style={{ color: "#000" }} />
          </button>
          {/* Autocomplete dropdown */}
          {showSuggestions && filtered.length > 0 && (
            <div className="absolute left-0 top-full z-50 mt-1 w-[180px] rounded-md border bg-white py-1 shadow-lg" style={{ borderColor: "var(--border)" }}>
              {filtered.map((s) => (
                <button key={s} onClick={() => { onAdd(s); setNewName(""); setShowAdd(false); setShowSuggestions(false); }}
                  className="flex w-full items-center px-3 py-1.5 text-[10px] hover:bg-gray-100" style={{ color: "var(--text-primary)" }}>
                  👤 {s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-[11px] opacity-50 hover:opacity-80 min-touch"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <Plus size={12} /> Speaker
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Formatting toolbar (inline, appears on focus)
   ══════════════════════════════════════════════════════ */

function FormatBar({
  entry, onToggleBold, onToggleItalic, onToggleUnderline,
  onInsertMarker, onSplit, onMergeNext, onDelete,
}: {
  entry: TranscriptionEntry;
  onToggleBold: () => void;
  onToggleItalic: () => void;
  onToggleUnderline: () => void;
  onInsertMarker: (type: "inaudible" | "sic" | "double_sub" | "low_confidence") => void;
  onSplit: () => void;
  onMergeNext: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 mb-1" style={{ backgroundColor: "var(--bg-secondary)" }}>
      <button onClick={onToggleBold} className={`rounded p-1 ${entry.bold ? "bg-gray-200" : "hover:bg-gray-200"}`} title="Bold">
        <Bold size={13} />
      </button>
      <button onClick={onToggleItalic} className={`rounded p-1 ${entry.italic ? "bg-gray-200" : "hover:bg-gray-200"}`} title="Italic">
        <Italic size={13} />
      </button>
      <button onClick={onToggleUnderline} className={`rounded p-1 ${entry.underline ? "bg-gray-200" : "hover:bg-gray-200"}`} title="Underline">
        <Underline size={13} />
      </button>
      <div className="w-px h-4 opacity-20 mx-0.5" style={{ backgroundColor: "var(--text-secondary)" }} />
      <button onClick={() => onInsertMarker("double_sub")} className="rounded p-1 hover:bg-gray-200 text-[10px] font-mono" title="Double subscript">
        <Subscript size={13} />
      </button>
      <button onClick={() => onInsertMarker("inaudible")} className="rounded p-1 hover:bg-gray-200" title="Inaudible">
        <VolumeX size={13} />
      </button>
      <button onClick={() => onInsertMarker("sic")} className="rounded p-1 hover:bg-gray-200 text-[10px] font-bold" title="SIC">
        SIC
      </button>
      <button onClick={() => onInsertMarker("low_confidence")} className="rounded p-1 hover:bg-gray-200 text-[10px] font-medium" title="Low confidence — ⚠ Baja confianza" style={{ borderBottom: "2px dotted #FBC02D" }}>
        ⚠
      </button>
      <div className="flex-1" />
      <button onClick={onSplit} className="rounded p-1 hover:bg-gray-200 opacity-50 hover:opacity-100" title="Split">
        <Scissors size={13} />
      </button>
      <button onClick={onMergeNext} className="rounded p-1 hover:bg-gray-200 opacity-50 hover:opacity-100" title="Merge with next">
        ⊞
      </button>
      <button onClick={onDelete} className="rounded p-1 hover:bg-red-100 text-red-500 opacity-50 hover:opacity-100" title="Delete">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Transcription Entry Row
   ══════════════════════════════════════════════════════ */

function EntryRow({
  entry, speakers,
  onUpdate, onPlay, onSpeakerChange, onFocus, onBlur,
  onSplit, onMergeNext, onDelete, onCreateNext,
}: {
  entry: TranscriptionEntry;
  speakers: Speaker[];
  onUpdate: (patch: Partial<TranscriptionEntry>) => void;
  onPlay: (t: number) => void;
  onSpeakerChange: (speakerId: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSplit: () => void;
  onMergeNext: () => void;
  onDelete: () => void;
  onCreateNext: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const speaker = speakers.find((s) => s.id === entry.speakerId);

  return (
    <div
      className={`group border-b px-3 py-2 transition-colors ${focused ? "" : ""}`}
      style={{ borderColor: "var(--border)", backgroundColor: focused ? "var(--bg-secondary)" : "transparent" }}
    >
      {/* Format bar (only when focused) */}
      {focused && (
        <FormatBar
          entry={entry}
          onToggleBold={() => onUpdate({ bold: !entry.bold })}
          onToggleItalic={() => onUpdate({ italic: !entry.italic })}
          onToggleUnderline={() => onUpdate({ underline: !entry.underline })}
          onInsertMarker={(type) => {
            const markers = entry.markers ?? [];
            onUpdate({ markers: [...markers, { start: 0, end: entry.text.length, type }] });
          }}
          onSplit={onSplit}
          onMergeNext={onMergeNext}
          onDelete={onDelete}
        />
      )}

      {/* Row */}
      <div className="flex items-start gap-2">
        {/* Play button */}
        <button
          onClick={() => onPlay(entry.timestamp)}
          className="mt-0.5 flex-shrink-0 rounded p-0.5 hover:bg-gray-200 opacity-30 hover:opacity-100 transition-opacity"
          aria-label="Play from timestamp"
          title={`Play from ${fmtTimestamp(entry.timestamp)}`}
        >
          <Play size={11} />
        </button>

        {/* Timestamp */}
        <span
          className="mt-0.5 min-w-[65px] flex-shrink-0 cursor-pointer rounded px-1.5 py-0 text-xs font-mono hover:bg-gray-100"
          style={{ color: "var(--text-secondary)" }}
          onClick={() => onPlay(entry.timestamp)}
          title="Click to seek"
        >
          {fmtTimestamp(entry.timestamp)}
        </span>

        {/* Speaker selector */}
        <select
          value={entry.speakerId}
          onChange={(e) => onSpeakerChange(e.target.value)}
          className="mt-0.5 flex-shrink-0 rounded border bg-transparent px-1.5 py-0.5 text-xs outline-none min-w-[80px] max-w-[140px]"
          style={{ borderColor: speaker?.color ?? "var(--border)", color: "var(--text-primary)" }}
        >
          <option value="">—</option>
          {speakers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {/* Textarea */}
        <textarea
          value={entry.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          onFocus={() => { setFocused(true); onFocus(); }}
          onBlur={() => { setFocused(false); onBlur(); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && e.currentTarget === document.activeElement) {
              const ta = e.currentTarget as HTMLTextAreaElement;
              const cursorAtEnd = ta.selectionStart === ta.value.length;
              if (cursorAtEnd) { e.preventDefault(); onCreateNext(); }
            }
          }}
          rows={Math.max(1, Math.ceil(entry.text.length / 80))}
          className="flex-1 resize-none border-0 bg-transparent py-0.5 text-sm outline-none"
          style={{
            color: "var(--text-primary)",
            fontFamily: "'Lora', Georgia, serif",
            fontWeight: entry.bold ? 600 : 400,
            fontStyle: entry.italic ? "italic" : "normal",
            textDecoration: entry.underline ? "underline" : "none",
          }}
          placeholder="Transcription text..."
        />
      </div>

      {/* Markers */}
      {entry.markers && entry.markers.length > 0 && (
        <div className="mt-1 ml-[103px] flex gap-1">
          {entry.markers.map((m, i) => (
            <span key={i} className="rounded-full px-1.5 py-0 text-[9px] font-medium"
              style={{
                backgroundColor: m.type === "inaudible" ? "rgba(241, 215, 255, 0.5)" : m.type === "sic" ? "#FFEBEE" : m.type === "low_confidence" ? "#FFF9C4" : "#E3F2FD",
                color: m.type === "inaudible" ? "#C4A0D4" : m.type === "sic" ? "#C62828" : m.type === "low_confidence" ? "#F57F17" : "#1565C0",
                borderBottom: m.type === "low_confidence" ? "2px dotted #FBC02D" : "none",
              }}
              title={m.type === "low_confidence" ? "⚠ Baja confianza — verificar manualmente" : undefined}>
              {m.type === "double_sub" ? "[[ ]]" : m.type === "inaudible" ? "[inaudible]" : m.type === "low_confidence" ? "⚠" : "[SIC]"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   TRANSCRIPTION EDITOR (main)
   ══════════════════════════════════════════════════════ */

interface TranscriptionEditorProps {
  doc: ProjectDocument;
  onClose?: () => void;
}

export function TranscriptionEditor({ doc, onClose }: TranscriptionEditorProps) {
  // ── Player state ──
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(doc.pageCount ? doc.pageCount * 60 : 600);
  const [splitPos, setSplitPos] = useState(40); // percentage for left panel

  // ── Speakers ──
  const [speakers, setSpeakers] = useState<Speaker[]>([
    { id: "s1", name: "Interviewer",    color: SPEAKER_COLORS[0] },
    { id: "s2", name: "Participant",    color: SPEAKER_COLORS[1] },
  ]);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>("s1");

  // ── Entries ──
  const [entries, setEntries] = useState<TranscriptionEntry[]>([
    { id: "e1", timestamp: 0,    speakerId: "s1", text: "" },
    { id: "e2", timestamp: 15,   speakerId: "s2", text: "" },
    { id: "e3", timestamp: 30,   speakerId: "s1", text: "" },
  ]);
  const [focusedEntry, setFocusedEntry] = useState<string | null>(null);

  // ── Split divider drag ──
  const dividerRef = useRef<HTMLDivElement>(null);

  const handleDividerDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = (e.target as HTMLElement).parentElement;
    if (!container) return;
    const startX = e.clientX;
    const startPct = splitPos;
    const containerW = container.getBoundingClientRect().width;

    const onMove = (ev: MouseEvent) => {
      const delta = ((ev.clientX - startX) / containerW) * 100;
      setSplitPos(Math.max(25, Math.min(60, startPct + delta)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "col-resize";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [splitPos]);

  // ── Simulate playback ──
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setCurrentTime((t) => {
        if (t >= duration) { setPlaying(false); return duration; }
        return t + 0.1;
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing, duration]);

  // ── Add timestamp at current position ──
  const insertTimestamp = useCallback(() => {
    const newEntry: TranscriptionEntry = {
      id: `e${Date.now()}`,
      timestamp: currentTime,
      speakerId: activeSpeaker ?? "",
      text: "",
    };
    // Insert at correct position (sorted by timestamp)
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.timestamp > currentTime);
      const next = [...prev];
      if (idx === -1) next.push(newEntry);
      else next.splice(idx, 0, newEntry);
      return next;
    });
  }, [currentTime, activeSpeaker]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire inside inputs
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) return;

      switch (e.key) {
        case "F4": e.preventDefault(); insertTimestamp(); break;
        case "F5": e.preventDefault(); setPlaying((p) => !p); break;
        case "F6": e.preventDefault(); setCurrentTime((t) => Math.max(0, t - 5)); break;
        case "F7": e.preventDefault(); setCurrentTime((t) => Math.min(duration, t + 5)); break;
        case "F8": e.preventDefault(); /* speed 0.5x */ break;
        case "F9": e.preventDefault(); /* speed 1.5x */ break;
        case "Escape":
          if (focusedEntry) {
            e.preventDefault();
            setFocusedEntry(null);
            (document.activeElement as HTMLElement)?.blur();
          }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [insertTimestamp, focusedEntry, duration]);

  // ── Add speaker ──
  const handleAddSpeaker = useCallback((name: string) => {
    const color = SPEAKER_COLORS[speakers.length % SPEAKER_COLORS.length];
    const id = `s${Date.now()}`;
    setSpeakers((prev) => [...prev, { id, name, color }]);
    setActiveSpeaker(id);
  }, [speakers.length]);

  // ── Entry operations ──
  const handleSplitEntry = useCallback((entryId: string) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entryId);
      if (idx === -1) return prev;
      const entry = prev[idx];
      // Split at cursor position if textarea is focused, otherwise at midpoint
      const activeEl = document.activeElement as HTMLTextAreaElement | null;
      const cursorPos = (activeEl && activeEl.tagName === "TEXTAREA")
        ? activeEl.selectionStart ?? activeEl.value.length / 2
        : Math.floor(entry.text.length / 2);
      const splitPoint = Math.max(1, Math.min(entry.text.length - 1, cursorPos));
      const first = { ...entry, id: `${entry.id}a`, text: entry.text.slice(0, splitPoint) };
      const second = { ...entry, id: `${entry.id}b`, text: entry.text.slice(splitPoint), timestamp: entry.timestamp + 0.5 };
      const next = [...prev];
      next.splice(idx, 1, first, second);
      return next;
    });
  }, []);

  const handleMergeNext = useCallback((entryId: string) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entryId);
      if (idx === -1 || idx >= prev.length - 1) return prev;
      const current = prev[idx];
      const next_ = prev[idx + 1];
      const merged: TranscriptionEntry = {
        ...current,
        text: current.text + " " + next_.text,
        id: current.id,
      };
      const result = [...prev];
      result.splice(idx, 2, merged);
      return result;
    });
  }, []);

  const handleDeleteEntry = useCallback((entryId: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
  }, []);

  // ── Save / Export ──
  const addDocument = useProjectStore((s) => s.addDocument);
  const project = useProjectStore((s) => s.project);
  const projectDocs = useProjectStore((s) => s.documents);
  // Build speaker name suggestions from other document names in the project
  const speakerSuggestions = projectDocs.map((d) => d.name).filter((n) => n && !n.startsWith("."));
  const { toast } = useToast();

  const handleSave = useCallback(() => {
    const transcriptId = `trans-${Date.now()}`;
    const contenidoHtml = entries.map((e) => {
      const sp = speakers.find((s) => s.id === e.speakerId);
      return `<p data-timestamp="${e.timestamp}" data-speaker="${sp?.name || ''}" data-speaker-color="${sp?.color || ''}"><span class="timestamp">[${fmtTimestamp(e.timestamp)}]</span> <span class="speaker" style="color:${sp?.color || '#F1D7FF'}">${sp?.name || '—'}:</span> ${e.text}</p>`;
    }).join("\n");

    // Save to SQLite backend
    if (project?.id) {
      bridgeSaveTranscription(transcriptId, doc.id, project.id, contenidoHtml, "es", JSON.stringify(speakers)).catch(() => {});
    }

    // Add as child document in project store
    addDocument({
      id: transcriptId,
      name: `${doc.name}_transcripcion`,
      type: "txt",
      path: "",
      size: contenidoHtml.length,
      addedAt: new Date().toISOString(),
      metadata_json: JSON.stringify({ tipo: "transcripcion", documento_padre_id: doc.id, entries: entries.length }),
    });

    toast.success("Transcription saved", `${entries.length} entries saved`);
  }, [entries, speakers, doc, project, addDocument, toast]);

  const handleExport = useCallback((format: ExportFormat) => {
    let content = "";
    if (format === "txt" || format === "docx") {
      content = entries.map((e) =>
        `[${fmtTimestamp(e.timestamp)}] ${speakers.find((s) => s.id === e.speakerId)?.name ?? "—"}: ${e.text}`
      ).join("\n\n");
    } else if (format === "srt") {
      content = entries.map((e, i) => {
        const next = entries[i + 1];
        const end = next ? next.timestamp : e.timestamp + 5;
        return `${i + 1}\n${fmtTimestamp(e.timestamp).replace(/^(\d+):(\d+):(\d+)$/, "$1:$2:$3")},000 --> ${fmtTimestamp(end).replace(/^(\d+):(\d+):(\d+)$/, "$1:$2:$3")},000\n${speakers.find((s) => s.id === e.speakerId)?.name ?? "—"}: ${e.text}\n`;
      }).join("\n");
    } else if (format === "clipboard") {
      content = entries.map((e) =>
        `[${fmtTimestamp(e.timestamp)}] ${speakers.find((s) => s.id === e.speakerId)?.name ?? "—"}: ${e.text}`
      ).join("\n\n");
      navigator.clipboard?.writeText(content).then(() => toast.success("Copied", "Transcription copied to clipboard")).catch(() => toast.error("Error", "Could not copy to clipboard"));
      return;
    }

    const ext = format === "docx" ? "txt" : format;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = globalThis.document.createElement("a");
    a.href = url;
    a.download = `${doc.name}_transcript.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [entries, speakers, doc.name, toast]);

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* ═══ Split panel: player (left) | editor (right) ═══ */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: compact player */}
        <div className="flex-shrink-0 overflow-hidden" style={{ width: `${splitPos}%` }}>
          <CompactPlayer
            doc={doc}
            currentTime={currentTime}
            duration={duration}
            playing={playing}
            onPlayPause={() => setPlaying((p) => !p)}
            onSeek={setCurrentTime}
            onSkip={(s) => setCurrentTime((t) => Math.max(0, Math.min(duration, t + s)))}
          />
        </div>

        {/* Draggable divider */}
        <div
          ref={dividerRef}
          className="w-1 flex-shrink-0 cursor-col-resize transition-colors hover:bg-peach-300 active:bg-peach-500 z-10"
          style={{ backgroundColor: "var(--border)" }}
          onMouseDown={handleDividerDrag}
        />

        {/* Right: editor */}
        <div className="flex flex-1 flex-col overflow-hidden" style={{ backgroundColor: "var(--bg-panel)" }}>
          {/* ═══ Speaker panel ═══ */}
          <SpeakerPanel
            speakers={speakers}
            activeId={activeSpeaker}
            onSelect={setActiveSpeaker}
            onAdd={handleAddSpeaker}
            suggestions={speakerSuggestions}
          />

          {/* ═══ Entries ═══ */}
          <div className="flex-1 overflow-y-auto">
            {entries.length === 0 ? (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div>
                  <Pencil size={32} className="mx-auto mb-3 opacity-15" />
                  <p className="text-sm opacity-25">No entries yet. Press F4 to insert a timestamp.</p>
                </div>
              </div>
            ) : (
              entries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  speakers={speakers}
                  onUpdate={(patch) => {
                    setEntries((prev) =>
                      prev.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)),
                    );
                  }}
                  onPlay={(t) => { setCurrentTime(t); setPlaying(true); }}
                  onSpeakerChange={(speakerId) => {
                    setEntries((prev) =>
                      prev.map((e) => (e.id === entry.id ? { ...e, speakerId } : e)),
                    );
                  }}
                  onFocus={() => setFocusedEntry(entry.id)}
                  onBlur={() => setFocusedEntry(null)}
                  onSplit={() => handleSplitEntry(entry.id)}
                  onMergeNext={() => handleMergeNext(entry.id)}
                  onDelete={() => handleDeleteEntry(entry.id)}
                  onCreateNext={() => {
                    const newEntry: TranscriptionEntry = {
                      id: `e${Date.now()}`,
                      timestamp: currentTime,
                      speakerId: entry.speakerId,
                      text: "",
                    };
                    setEntries((prev) => {
                      const idx = prev.findIndex((e) => e.id === entry.id);
                      const next = [...prev];
                      next.splice(idx + 1, 0, newEntry);
                      return next;
                    });
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ═══ Bottom bar 32px ═══ */}
      <div
        className="flex items-center gap-3 border-t px-4 text-xs"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)", height: 32 }}
      >
        <span className="opacity-40">
          {entries.length} de {entries.length || 1} entradas · {entries.length > 0 ? Math.round(entries.filter((e) => e.text.trim()).length / Math.max(1, entries.length) * 100) : 0}% completado
        </span>
        <div className="flex-1" />
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 rounded-md bg-peach-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-peach-700 min-h-7"
        >
          <Save size={12} /> Save
        </button>

        {/* Export dropdown */}
        <div className="relative group">
          <button className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50 min-touch"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
            <Download size={12} /> Export <ChevronDown size={10} />
          </button>
          <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block rounded-md border bg-white py-1 shadow-lg z-50"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
            {(["txt", "docx", "srt", "clipboard"] as ExportFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleExport(fmt)}
                className="block w-full px-4 py-1.5 text-left text-xs hover:bg-gray-100 whitespace-nowrap min-touch"
                style={{ color: "var(--text-primary)" }}
              >
                {fmt === "txt" ? "📄 Text (.txt)" : fmt === "docx" ? "📝 Word (.docx)" : fmt === "srt" ? "📺 Subtitles (.srt)" : "📋 Copy to clipboard"}
              </button>
            ))}
          </div>
        </div>

        {/* ✕ Cerrar */}
        {onClose && (
          <button
            onClick={onClose}
            className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-gray-50 min-h-7"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <X size={12} /> Cerrar
          </button>
        )}
      </div>
    </div>
  );
}

export default TranscriptionEditor;
