import { useState, useCallback, useRef, useEffect } from "react";
import {
  Play, Pause, SkipBack, SkipForward, Volume2,
  Mic, FileText, List, ChevronRight,
  Download, X, Save, Volume1,
} from "lucide-react";
import { useProjectStore, type ProjectDocument } from "../../stores/projectStore";
import { TranscriptionEditor } from "./TranscriptionEditor";
import { WhisperTranscriber } from "../tools/WhisperTranscriber";
import { useTTSStore } from "../../stores/ttsStore";
import { usePositionMemory } from "../../lib/positionMemory";

/* ══════════════════════════════════════════════════════════════
   Types
   ══════════════════════════════════════════════════════════════ */

interface CitationMark {
  id: string;
  startTime: number;    // seconds
  endTime: number;
  category: string;
  categoryColor: string;
  researcherColor: string;
  comment?: string;
  chapter?: string;     // if set, this is a chapter marker
}

interface AudioPlayerProps {
  document: ProjectDocument;
  /** Playlist: all audio/video docs for this project */
  playlist?: ProjectDocument[];
  onSelectTrack?: (doc: ProjectDocument) => void;
}

/* ══════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════ */

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/* ══════════════════════════════════════════════════════════════
   Waveform placeholder (wavesurfer.js integration point)
   ══════════════════════════════════════════════════════════════ */

function Waveform({
  duration, currentTime, zoom, marks, onSeek, onZoomChange,
}: {
  duration: number; currentTime: number; zoom: number;
  marks: CitationMark[]; onSeek: (t: number) => void; onZoomChange: (z: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Ctrl+scroll → zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    onZoomChange(Math.max(1, Math.min(50, zoom + delta * 10)));
  }, [zoom, onZoomChange]);

  // Click on waveform → seek
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || duration <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    onSeek(x * duration);
  }, [duration, onSeek]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative h-[120px] w-full cursor-pointer select-none overflow-hidden rounded-md"
      style={{ backgroundColor: "#161A22" }}
      onClick={handleClick}
      onWheel={handleWheel}
      title="Ctrl+scroll to zoom · Click to seek"
    >
      {/* ═══ Waveform bars (simulated — wavesurfer.js mounts here) ═══ */}
      <div className="absolute inset-0 flex items-end gap-px px-2 opacity-30" style={{ paddingBottom: 12 }}>
        {Array.from({ length: Math.floor(120 * zoom) }, (_, i) => {
          const h = 20 + Math.abs(Math.sin(i * 0.3 + Math.cos(i * 0.07))) * 70 + 0 * 15;
          return (
            <div
              key={i}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${h}%`,
                backgroundColor: (i / (120 * zoom)) * duration <= currentTime ? "var(--peach)" : "rgba(241, 215, 255, 0.6)",
                opacity: (i / (120 * zoom)) * duration <= currentTime ? 1 : 0.5,
              }}
            />
          );
        })}
      </div>

      {/* ═══ Citation markers (vertical lines) ═══ */}
      {marks.map((mark) => {
        const leftPct = duration > 0 ? (mark.startTime / duration) * 100 : 0;
        const widthPct = duration > 0 ? ((mark.endTime - mark.startTime) / duration) * 100 : 0;
        return (
          <div
            key={mark.id}
            className="absolute top-0 h-full cursor-pointer transition-opacity hover:opacity-90"
            style={{
              left: `${leftPct}%`,
              width: Math.max(2, widthPct),
              backgroundColor: mark.categoryColor,
              opacity: 0.35,
            }}
            title={`${mark.category} [${fmtTime(mark.startTime)}–${fmtTime(mark.endTime)}]${mark.comment ? ` — ${mark.comment}` : ""}`}
          />
        );
      })}

      {/* ═══ Progress overlay (peach-500 over played section) ═══ */}
      <div
        className="absolute top-0 left-0 h-full pointer-events-none mix-blend-overlay"
        style={{
          width: `${progressPct}%`,
          backgroundColor: "var(--peach)",
          opacity: 0.15,
        }}
      />

      {/* ═══ Cursor line ═══ */}
      <div
        className="absolute top-0 h-full w-0.5 bg-white pointer-events-none shadow-md z-10"
        style={{ left: `${progressPct}%`, transition: "left 100ms linear" }}
      />

      {/* ═══ wavesurfer.js would mount to this container in production ═══ */}
      <p className="absolute bottom-1 left-2 text-[9px] opacity-20 select-none pointer-events-none">
        wavesurfer.js · zoom {zoom.toFixed(1)}×
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Citation marking panel (floating)
   ══════════════════════════════════════════════════════════════ */

function MarkPanel({
  startTime, endTime, onSave, onClose,
}: {
  startTime: number; endTime: number;
  onSave: (comment: string, category: string, weight: number) => void;
  onClose: () => void;
}) {
  const [comment, setComment] = useState("");
  const [category, setCategory] = useState("");
  const [weight, setWeight] = useState(50);

  return (
    <div
      className="absolute bottom-16 left-4 z-20 w-[280px] rounded-lg p-4 shadow-xl"
      style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--border)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
          New citation · {fmtTime(startTime)}–{fmtTime(endTime)}
        </span>
        <button onClick={onClose} className="rounded p-0.5 hover:bg-gray-100"><X size={14} /></button>
      </div>

      <input
        autoFocus
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Category name"
        className="mb-2 w-full rounded border px-2.5 py-1.5 text-xs outline-none"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
      />

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Comment (optional)"
        rows={2}
        className="mb-2 w-full resize-none rounded border px-2.5 py-1.5 text-xs outline-none"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
      />

      {/* Weight slider */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[10px] opacity-50">Weight</span>
        <input
          type="range" min={1} max={100} value={weight}
          onChange={(e) => setWeight(Number(e.target.value))}
          className="flex-1" style={{ accentColor: "var(--peach)" }}
        />
        <span className="text-[10px] font-mono opacity-50">{weight}</span>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded px-3 py-1.5 text-xs hover:bg-gray-100" style={{ color: "var(--text-secondary)" }}>Cancel</button>
        <button
          onClick={() => onSave(comment, category, weight)}
          className="flex items-center gap-1 rounded bg-peach-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-peach-700"
        >
          <Save size={12} /> Save
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Playlist sidebar
   ══════════════════════════════════════════════════════════════ */

function PlaylistSidebar({
  tracks, currentId, autoplay, onSelect, onToggleAutoplay, onClose,
}: {
  tracks: ProjectDocument[];
  currentId: string;
  autoplay: boolean;
  onSelect: (doc: ProjectDocument) => void;
  onToggleAutoplay: () => void;
  onClose: () => void;
}) {
  const audioVideo = tracks.filter((t) => t.type === "audio" || t.type === "video");

  return (
    <div
      className="flex h-full w-[200px] flex-shrink-0 flex-col border-l"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}
    >
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Playlist</span>
        <button onClick={onClose} className="rounded p-0.5 hover:bg-gray-100"><ChevronRight size={14} /></button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {audioVideo.map((track) => {
          const isActive = track.id === currentId;
          const typeIcon = track.type === "audio" ? "🎙" : "🎬";
          return (
            <button
              key={track.id}
              onClick={() => onSelect(track)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-gray-100 ${
                isActive ? "font-medium" : ""
              }`}
              style={{
                color: "#000",
                backgroundColor: isActive ? "var(--bg-secondary)" : "transparent",
              }}
            >
              <span>{typeIcon}</span>
              <span className="truncate flex-1">{track.name}</span>
            </button>
          );
        })}
      </div>

      <div className="border-t px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <label className="flex items-center gap-2 text-[10px] cursor-pointer" style={{ color: "var(--text-secondary)" }}>
          <input type="checkbox" checked={autoplay} onChange={onToggleAutoplay} style={{ accentColor: "var(--peach)" }} />
          Autoplay next track
        </label>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AUDIO PLAYER (main)
   ══════════════════════════════════════════════════════════════ */

export function AudioPlayer({ document, playlist = [], onSelectTrack }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration] = useState(document.pageCount ? document.pageCount * 60 : 180);
  const [speed, setSpeed] = useState<number>(() => {
    try {
      const meta = JSON.parse(document.metadata_json ?? "{}");
      return meta.speed ?? 1;
    } catch { return 1; }
  });
  const [volume, setVolume] = useState(0.8);
  const [zoom, setZoom] = useState(1);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [filterResearcher, setFilterResearcher] = useState<string | null>(null);
  const [showTranscriptionEditor, setShowTranscriptionEditor] = useState(false);
  const [showWhisper, setShowWhisper] = useState(false);
  const openTTS = useTTSStore((s) => s.open);
  const proyectoId = useProjectStore((s) => s.project?.id);
  const { restorePosition: restoreAudioPos, savePage: saveAudioPos, flushPosition: flushAudioPos } = usePositionMemory(document.id, proyectoId);

  // Restore audio position on mount
  useEffect(() => {
    restoreAudioPos().then((pos) => {
      if (pos && pos.pagina) setCurrentTime(pos.pagina);
    });
  }, [document.id]);

  // Save position periodically during playback
  useEffect(() => {
    if (!playing || !proyectoId) return;
    const interval = setInterval(() => {
      saveAudioPos(Math.floor(currentTime), 0, 1);
    }, 5000);
    return () => clearInterval(interval);
  }, [playing, currentTime, proyectoId]);

  // Flush position on unmount
  useEffect(() => { return () => { flushAudioPos(); }; }, [document.id]);

  // Citation state
  const [marks, setMarks] = useState<CitationMark[]>([]);
  const [marking, setMarking] = useState<{ start: number; end: number } | null>(null);
  const [exportMode, setExportMode] = useState(false);
  const [checkedMarks, setCheckedMarks] = useState<Set<string>>(new Set());

  // Simulate playback timer
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setCurrentTime((t) => {
        if (t >= duration) { setPlaying(false); return duration; }
        return t + 0.1 * speed;
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing, duration, speed]);

  // Save speed per file
  useEffect(() => {
    try {
      const raw = document.metadata_json;
      const meta = raw ? JSON.parse(raw) : {};
      meta.speed = speed;
      // In production: persist to projectStore
    } catch { /* noop */ }
  }, [speed, document]);

  const seek = useCallback((t: number) => {
    setCurrentTime(Math.max(0, Math.min(duration, t)));
  }, [duration]);

  const skip = useCallback((s: number) => {
    setCurrentTime((t) => Math.max(0, Math.min(duration, t + s)));
  }, [duration]);

  const toggleMark = useCallback(() => {
    if (marking) {
      // Second press → set end
      setMarking(null);
      setCurrentTime((t) => { /* mark panel will open */ return t; });
    } else {
      // First press → set start
      setMarking({ start: currentTime, end: currentTime });
    }
  }, [marking, currentTime]);

  const saveMark = useCallback((comment: string, category: string, _weight: number) => {
    if (!marking) return;
    setMarks((prev) => [
      ...prev,
      {
        id: `m${Date.now()}`,
        startTime: marking.start,
        endTime: currentTime,
        category: category || "Uncategorized",
        categoryColor: "#F1D7FF",
        researcherColor: "#4CAF50",
        comment: comment || undefined,
      },
    ]);
    setMarking(null);
  }, [marking, currentTime]);

  // Export clips
  const exportClips = useCallback(() => {
    const toExport = exportMode
      ? marks.filter((m) => checkedMarks.has(m.id))
      : marks;
    if (toExport.length === 0) return;
    const manifest = toExport.map((m) => ({
      name: `${document.name.replace(/\s+/g, "_")}_${Math.round(m.startTime)}_${m.category}.mp3`,
      start: m.startTime,
      end: m.endTime,
    }));
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = globalThis.document.createElement("a");
    a.href = url;
    a.download = `${document.name}_clips_manifest.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [marks, document.name, exportMode, checkedMarks]);

  const visibleMarks = filterResearcher
    ? marks.filter((m) => m.researcherColor === filterResearcher)
    : marks;

  const uniqueResearchers = [...new Set(marks.map((m) => m.researcherColor))];

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "#1E2028", color: "#E0E0E0" }}>
      {/* ═══ Document info bar ═══ */}
      <div className="flex items-center gap-3 border-b px-4 py-2 text-xs" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <span className="font-medium">{document.name}</span>
        <span className="opacity-40">{fmtTime(duration)}</span>
        <div className="flex-1" />
        <button
          onClick={() => setShowPlaylist((o) => !o)}
          className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors ${
            showPlaylist ? "bg-white/10" : "hover:bg-white/5"
          }`}
        >
          <List size={12} /> {showPlaylist ? "Hide" : "Playlist"}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ═══ Main area ═══ */}
        <div className="flex flex-1 flex-col">
          {/* Waveform */}
          <div className="px-4 pt-4">
            <Waveform
              duration={duration}
              currentTime={currentTime}
              zoom={zoom}
              marks={visibleMarks}
              onSeek={seek}
              onZoomChange={setZoom}
            />
          </div>

          {/* ═══ Progress bar ═══ */}
          <div
            className="relative mx-4 mt-3 h-[6px] cursor-pointer rounded-full"
            style={{ backgroundColor: "#2D3F55" }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = (e.clientX - rect.left) / rect.width;
              seek(x * duration);
            }}
            title="Click to seek"
          >
            {/* Played */}
            <div
              className="absolute top-0 left-0 h-full rounded-full"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`, backgroundColor: "var(--peach)" }}
            />
            {/* Diamond markers */}
            {marks.map((m) => {
              const pct = duration > 0 ? (m.startTime / duration) * 100 : 0;
              return (
                <div
                  key={m.id}
                  className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-sm cursor-pointer"
                  style={{ left: `${pct}%`, backgroundColor: m.categoryColor }}
                  title={`${m.category} — ${fmtTime(m.startTime)}`}
                />
              );
            })}
          </div>

          {/* ═══ Time display ═══ */}
          <div className="flex items-center justify-between px-4 py-1 text-[10px] font-mono opacity-50">
            <span>{fmtTime(currentTime)}</span>
            <span>{fmtTime(duration)}</span>
          </div>

          {/* ═══ Controls Row 1: Transport ═══ */}
          <div className="flex items-center justify-center gap-2 px-4 py-1">
            <button onClick={() => seek(0)} className="rounded p-1.5 hover:bg-white/10 min-touch" aria-label="Go to start" title="Start">
              <SkipBack size={16} />
            </button>
            <button onClick={() => skip(-5)} className="rounded p-1.5 hover:bg-white/10 text-xs min-touch" aria-label="Rewind 5s">⏪ 5s</button>
            <button onClick={() => skip(-2)} className="rounded p-1.5 hover:bg-white/10 text-xs min-touch" aria-label="Rewind 2s">⏪ 2s</button>

            {/* Play/Pause — 44px peach-500 */}
            <button
              onClick={() => setPlaying((p) => !p)}
              className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-peach-500 text-white hover:bg-peach-700 transition-colors min-touch"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
            </button>

            <button onClick={() => skip(2)} className="rounded p-1.5 hover:bg-white/10 text-xs min-touch" aria-label="Forward 2s">2s ⏩</button>
            <button onClick={() => skip(5)} className="rounded p-1.5 hover:bg-white/10 text-xs min-touch" aria-label="Forward 5s">5s ⏩</button>
            <button onClick={() => seek(duration)} className="rounded p-1.5 hover:bg-white/10 min-touch" aria-label="Go to end" title="End">
              <SkipForward size={16} />
            </button>
          </div>

          {/* ═══ Controls Row 2: Volume, Speed, Mark, Transcribe, Playlist ═══ */}
          <div className="flex items-center justify-center gap-3 px-4 py-2">
            {/* Volume slider */}
            <div className="flex items-center gap-1.5">
              <Volume2 size={14} opacity={0.5} />
              <div className="w-[80px]">
                <input
                  type="range" min={0} max={1} step={0.05} value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full" style={{ accentColor: "var(--peach)" }}
                  aria-label="Volume"
                />
              </div>
            </div>

            {/* Speed chips */}
            <div className="flex items-center gap-0.5">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`rounded px-1.5 py-0.5 text-[11px] font-mono transition-colors min-touch ${
                    speed === s ? "bg-peach-500 text-white" : "text-white/50 hover:bg-white/10"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>

            <div className="w-px h-5 opacity-20" style={{ backgroundColor: "#fff" }} />

            {/* Mark / Transcribe / Playlist */}
            <button
              onClick={toggleMark}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors min-touch ${
                marking ? "bg-peach-500 text-white" : "text-white/60 hover:bg-white/10"
              }`}
            >
              <Mic size={13} /> {marking ? "Set end" : "Mark"}
            </button>
            <button
              onClick={() => setShowTranscriptionEditor(true)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 min-touch"
            >
              <FileText size={13} /> Transcribe
            </button>
            <button
              onClick={() => setShowWhisper(true)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 min-touch"
              title="Auto-transcribe with Whisper"
            >
              <Mic size={13} /> Auto
            </button>
            <button
              onClick={() => openTTS(`Audio: ${document.name}`)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 min-touch"
              title="Text to speech"
            >
              <Volume1 size={13} /> TTS
            </button>
            <button
              onClick={() => setShowPlaylist((o) => !o)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-white/60 hover:bg-white/10 min-touch"
            >
              <List size={13} /> Playlist
            </button>
          </div>

          {/* ═══ Marks list ═══ */}
          <div className="flex-1 overflow-y-auto border-t px-4 py-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            {/* Filter */}
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] opacity-40">Filter:</span>
              <select
                value={filterResearcher ?? ""}
                onChange={(e) => setFilterResearcher(e.target.value || null)}
                className="rounded border bg-transparent px-1.5 py-0.5 text-[10px]"
                style={{ borderColor: "rgba(255,255,255,0.15)", color: "#E0E0E0" }}
              >
                <option value="">All researchers</option>
                {uniqueResearchers.map((c, i) => (
                  <option key={i} value={c}>Researcher {i + 1}</option>
                ))}
              </select>

              <div className="flex-1" />

              {/* Export clips */}
              <button
                onClick={() => {
                  if (exportMode) {
                    exportClips();
                    setExportMode(false);
                  } else {
                    setExportMode(true);
                  }
                }}
                className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] min-touch ${
                  exportMode ? "bg-peach-500 text-white" : "text-white/50 hover:bg-white/10"
                }`}
              >
                {exportMode ? (
                  <><Download size={11} /> Export selected</>
                ) : (
                  <><Download size={11} /> Export clips</>
                )}
              </button>
              {exportMode && (
                <button onClick={() => { setExportMode(false); setCheckedMarks(new Set()); }} className="rounded p-1 text-white/40 hover:text-white/80">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Marks */}
            {visibleMarks.length === 0 ? (
              <p className="py-4 text-center text-[10px] opacity-25">No marks yet. Press 🎙 Mark while playing.</p>
            ) : (
              <div className="space-y-1">
                {visibleMarks.map((mark) => (
                  <div
                    key={mark.id}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-white/5 group"
                  >
                    {exportMode && (
                      <input
                        type="checkbox"
                        checked={checkedMarks.has(mark.id)}
                        onChange={() => {
                          setCheckedMarks((prev) => {
                            const next = new Set(prev);
                            next.has(mark.id) ? next.delete(mark.id) : next.add(mark.id);
                            return next;
                          });
                        }}
                        style={{ accentColor: "var(--peach)" }}
                      />
                    )}
                    {/* Researcher color dot */}
                    <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: mark.researcherColor }} />
                    {/* Category color line */}
                    <span className="inline-block w-1.5 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: mark.categoryColor }} />
                    {/* Time range */}
                    <span className="font-mono text-[10px] text-white/40 flex-shrink-0">
                      {fmtTime(mark.startTime)}–{fmtTime(mark.endTime)}
                    </span>
                    {/* Category name */}
                    <span className="font-medium flex-shrink-0">{mark.category}</span>
                    {/* Comment */}
                    {mark.comment && (
                      <span className="truncate text-white/40">{mark.comment}</span>
                    )}
                    {/* Chapter badge */}
                    {mark.chapter && (
                      <span className="rounded-full bg-peach-500/20 px-1.5 py-0 text-[9px] text-peach-200 flex-shrink-0">
                        {mark.chapter}
                      </span>
                    )}
                    <div className="flex-1" />
                    {/* Actions */}
                    <button onClick={() => seek(mark.startTime)} className="rounded p-0.5 text-white/30 hover:text-white/80 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Play from mark">
                      <Play size={10} />
                    </button>
                    <button onClick={() => { const newLabel = prompt("Edit marker label:", mark.category); if (newLabel) setMarks((prev) => prev.map((m) => m.id === mark.id ? { ...m, category: newLabel } : m)); }}
                      className="rounded p-0.5 text-white/30 hover:text-white/80 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Edit">
                      <FileText size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ═══ Mark panel (floating) ═══ */}
          {marking && (
            <MarkPanel
              startTime={marking.start}
              endTime={currentTime}
              onSave={saveMark}
              onClose={() => setMarking(null)}
            />
          )}
        </div>

        {/* ═══ Playlist sidebar ═══ */}
        {showPlaylist && (
          <PlaylistSidebar
            tracks={playlist.length > 0 ? playlist : [document]}
            currentId={document.id}
            autoplay={autoplay}
            onSelect={(doc) => onSelectTrack?.(doc)}
            onToggleAutoplay={() => setAutoplay((a) => !a)}
            onClose={() => setShowPlaylist(false)}
          />
        )}
      </div>

      {/* Transcription editor */}
      {showTranscriptionEditor && (
        <TranscriptionEditor doc={document} onClose={() => setShowTranscriptionEditor(false)} />
      )}

      {/* Whisper auto-transcription */}
      <WhisperTranscriber
        open={showWhisper}
        documentId={document.id}
        documentName={document.name}
        audioSrc={document.path}
        duration={duration}
        fileSize={document.size}
        onClose={() => setShowWhisper(false)}
        onTranscriptionReady={() => {
          setShowWhisper(false);
          setShowTranscriptionEditor(true);
        }}
      />
    </div>
  );
}

export default AudioPlayer;
