import { useState, useCallback, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward, Tag, Bookmark, Camera, X, Save, FileText, Volume1, Plus } from "lucide-react";
import { useCodingStore } from "../../stores/codingStore";
import { useProjectStore } from "../../stores/projectStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { useToast } from "../../stores/toastStore";
import { useTTSStore } from "../../stores/ttsStore";
import { WhisperTranscriber } from "../tools/WhisperTranscriber";

interface VideoPlayerProps {
  src: string;
  title: string;
  documentId?: string;
}

interface TimelineMarker {
  id: string;
  time: number;
  label: string;
  color: string;
  comment?: string;
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function VideoPlayer({ src, title, documentId }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [seeking] = useState(false);

  // Timeline markers (coded segments)
  const [markers, setMarkers] = useState<TimelineMarker[]>([]);
  // Drag-to-select on timeline
  const [selStart, setSelStart] = useState<number | null>(null);
  const [selEnd, setSelEnd] = useState<number | null>(null);
  const [draggingSel, setDraggingSel] = useState(false);
  // Coding panel
  const [showCodingPanel, setShowCodingPanel] = useState(false);
  const [segmentName, setSegmentName] = useState("");
  const [segmentCategory, setSegmentCategory] = useState("");
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const [segmentComment, setSegmentComment] = useState("");

  const [showTranscribe, setShowTranscribe] = useState(false);

  // ── Transcription result handling ──
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [pendingTranscriptText, setPendingTranscriptText] = useState("");
  const [pendingTranscriptSpeakers, setPendingTranscriptSpeakers] = useState<Array<{ name: string; color: string }>>([]);
  const [transcriptDocName, setTranscriptDocName] = useState("");

  const { toast } = useToast();
  const openTTS = useTTSStore((s) => s.open);
  const addSegmentComment = useCodingStore((s) => s.addSegmentComment);
  const addMemo = useProjectStore((s) => s.addMemo);
  const addCategory = useProjectStore((s) => s.addCategory);
  const addDocument = useProjectStore((s) => s.addDocument);
  const projectCategories = useProjectStore((s) => s.categories);
  const highlightTarget = useLayoutStore((s) => s.highlightTarget);
  const setHighlightTarget = useLayoutStore((s) => s.setHighlightTarget);
  const setSelectedDocId = useLayoutStore((s) => s.setSelectedDocId);

  // ── Handle saving transcription as a document ──
  const handleConfirmSaveTranscript = useCallback(() => {
    const name = transcriptDocName.trim() || `Transcripción: ${title}`;
    const speakerLabel = pendingTranscriptSpeakers.length > 1
      ? `\n\n---\nLocutores: ${pendingTranscriptSpeakers.map((s) => s.name).join(", ")}`
      : "";
    const docId = `doc-trans-${Date.now()}`;
    const content = pendingTranscriptText + speakerLabel;
    // Save content to localStorage so it survives refreshes
    try {
      localStorage.setItem(`kdcm_doc_${docId}`, content);
    } catch { /* noop */ }
    // Create a blob URL for immediate access
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);
    addDocument({
      id: docId,
      name: `${name}.txt`,
      type: "txt",
      path: blobUrl,
      size: blob.size,
      addedAt: new Date().toISOString(),
      metadata_json: JSON.stringify({
        tipo: "transcripcion",
        documento_padre_id: documentId ?? "",
        speakers: pendingTranscriptSpeakers,
      }),
    });
    // Also persist to DB for durability (fire-and-forget)
    import("../../lib/tauriBridge").then(({ execQuery }) => {
      execQuery(
        "INSERT INTO documento_contenido (documento_id, contenido_html, proyecto_id) VALUES (?1, ?2, ?3)",
        [docId, content, useProjectStore.getState().project?.id ?? ""]
      ).catch(() => {});
    });
    setShowSaveDialog(false);
    setPendingTranscriptText("");
    setSelectedDocId(docId);
    toast.success("Documento creado", `"${name}" — abierto en el panel central`);
  }, [transcriptDocName, title, pendingTranscriptText, pendingTranscriptSpeakers, documentId, addDocument, setSelectedDocId, toast]);

  // Jump to timestamp when navigating from a memo
  useEffect(() => {
    if (!highlightTarget || !videoRef.current) return;
    try {
      const data = JSON.parse(highlightTarget);
      if (data.type === "video" && typeof data.timestamp === "number") {
        videoRef.current.currentTime = data.timestamp;
        setCurrentTime(data.timestamp);
        // Highlight segment on timeline by setting markers visual
        const timer = setTimeout(() => setHighlightTarget(null), 5000);
        return () => clearTimeout(timer);
      }
    } catch { /* ignore */ }
  }, [highlightTarget, setHighlightTarget]);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    if (!seeking && videoRef.current) setCurrentTime(videoRef.current.currentTime);
  }, [seeking]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  }, []);

  const handlePlayPause = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const t = pct * duration;
    v.currentTime = t;
    setCurrentTime(t);
  }, [duration]);

  const skip = useCallback((s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + s));
  }, [duration]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  // ── Drag-to-select on timeline ──
  const getTimelineRect = useCallback(() => {
    if (!timelineRef.current) return { left: 0, width: 1 };
    return timelineRef.current.getBoundingClientRect();
  }, []);

  const handleTimelineMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = getTimelineRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = pct * duration;
    setSelStart(t);
    setSelEnd(t);
    setDraggingSel(true);
    e.preventDefault();
  }, [duration, getTimelineRect]);

  const handleTimelineMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingSel) return;
    const rect = getTimelineRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = pct * duration;
    setSelEnd(t);
  }, [draggingSel, duration, getTimelineRect]);

  const handleTimelineMouseUp = useCallback(() => {
    if (!draggingSel || selStart === null || selEnd === null) { setDraggingSel(false); return; }
    setDraggingSel(false);
    const start = Math.min(selStart, selEnd);
    const end = Math.max(selStart, selEnd);
    if (end - start < 0.5) { setSelStart(null); setSelEnd(null); return; }
    setSegmentName(`${title} [${fmtTime(start)}–${fmtTime(end)}]`);
    setSegmentCategory("");
    setSegmentComment("");
    setShowCodingPanel(true);
    setSelStart(start);
    setSelEnd(end);
  }, [draggingSel, selStart, selEnd, title]);

  // ── Save coded segment ──
  const handleSaveSegment = useCallback(() => {
    if (selStart === null || selEnd === null) return;
    const start = Math.min(selStart, selEnd);
    const end = Math.max(selStart, selEnd);
    const id = `vid-${Date.now()}`;
    const color = segmentCategory ? `#${Math.floor(0 * 0xffffff).toString(16).padStart(6, "0")}` : "#4CAF50";
    const name = segmentName.trim() || `Segment ${fmtTime(start)}–${fmtTime(end)}`;
    // Add marker on timeline
    setMarkers((prev) => [...prev, { id, time: start, label: name, color, comment: segmentComment || undefined }]);
    // Add end marker
    setMarkers((prev) => [...prev, { id: `${id}-end`, time: end, label: `${name} (end)`, color, comment: undefined }]);
    // Create category in project
    addCategory({ id, name, color, parentId: null, count: 1, description: `Video: ${title} [${fmtTime(start)}–${fmtTime(end)}]` + (segmentComment ? ` — ${segmentComment}` : "") });
    if (segmentComment.trim()) {
      addSegmentComment(id, segmentComment.trim(), "You");
      addMemo({ id: `memo-${id}`, title: `Video: ${name}`, content: segmentComment.trim(), linkedDocIds: [documentId ?? id], linkedCodeIds: [JSON.stringify({ type: "video", docId: documentId ?? id, timestamp: start })], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    setShowCodingPanel(false);
    setSelStart(null);
    setSelEnd(null);
    toast.success("Segment coded", `"${name}" — view in Codes & Memos panels`);
  }, [selStart, selEnd, segmentName, segmentCategory, segmentComment, addCategory, addSegmentComment, addMemo, toast, title]);

  // ── Screenshot capture ──
  const handleScreenshot = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      addDocument({
        id: `cap-${Date.now()}`, name: `${title} — frame ${fmtTime(currentTime)}.png`,
        type: "image", path: url, size: blob.size, addedAt: new Date().toISOString(),
      });
      toast.success("Screenshot saved", `Frame at ${fmtTime(currentTime)} added to Documents`);
    }, "image/png");
  }, [currentTime, title, addDocument, toast]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
    <div
      ref={containerRef}
      className="relative flex items-center justify-center bg-black overflow-hidden group"
      style={{ aspectRatio: "16/9", maxHeight: "80vh" }}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => setShowControls(false)}
      onDoubleClick={toggleFullscreen}
    >
      <video
        ref={videoRef} src={src}
        className="h-full w-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setPlaying(false)}
        onClick={handlePlayPause}
      />

      {/* Title overlay */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent px-4 py-3 pointer-events-none">
        <p className="text-sm font-medium text-white">{title}</p>
      </div>

      {/* Timeline markers as diamonds */}
      {markers.map((m) => {
        const leftPct = duration > 0 ? (m.time / duration) * 100 : 0;
        return (
          <div key={m.id} className="absolute bottom-[60px] -translate-x-1/2" style={{ left: `${leftPct}%` }}>
            <div className="h-2.5 w-2.5 rotate-45 rounded-sm cursor-pointer hover:scale-150 transition-transform" style={{ backgroundColor: m.color }} title={`${m.label}${m.comment ? ` — ${m.comment}` : ""}`} />
          </div>
        );
      })}

      {/* Overlay controls */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10 transition-opacity duration-300 ${showControls || !playing ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        {/* Timeline with drag-to-select */}
        <div
          ref={timelineRef}
          className="group/timeline relative mb-2 h-[5px] w-full cursor-pointer rounded-full bg-white/20 hover:h-[7px] transition-all"
          onMouseDown={handleTimelineMouseDown}
          onMouseMove={handleTimelineMouseMove}
          onMouseUp={handleTimelineMouseUp}
          onMouseLeave={() => setDraggingSel(false)}
          onClick={!draggingSel ? handleSeek : undefined}
        >
          <div className="absolute top-0 left-0 h-full rounded-full bg-white/30" style={{ width: "60%" }} />
          <div className="absolute top-0 left-0 h-full rounded-full" style={{ width: `${progressPct}%`, backgroundColor: "var(--peach)" }} />
          {/* Selection range overlay */}
          {selStart !== null && selEnd !== null && Math.abs(selEnd - selStart) > 0.1 && (
            <div className="absolute top-0 h-full rounded-full bg-peach-500/60" style={{
              left: `${duration > 0 ? (Math.min(selStart, selEnd) / duration) * 100 : 0}%`,
              width: `${duration > 0 ? (Math.abs(selEnd - selStart) / duration) * 100 : 0}%`,
            }} />
          )}
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-white shadow-md opacity-0 group-hover/timeline:opacity-100 transition-opacity" style={{ left: `${progressPct}%` }} />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-3 text-white">
          <button onClick={() => skip(-10)} className="rounded p-1 hover:bg-white/10 min-touch" aria-label="Rewind 10s"><SkipBack size={16} /></button>
          <button onClick={handlePlayPause} className="rounded p-1 hover:bg-white/10 min-touch" aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button onClick={() => skip(10)} className="rounded p-1 hover:bg-white/10 min-touch" aria-label="Forward 10s"><SkipForward size={16} /></button>

          <div className="flex items-center gap-1.5">
            <button onClick={() => setMuted((m) => !m)} className="rounded p-1 hover:bg-white/10 min-touch" aria-label={muted ? "Unmute" : "Mute"}>
              {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <div className="w-[60px]">
              <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
                className="w-full" style={{ accentColor: "var(--peach)" }} aria-label="Volume" />
            </div>
          </div>

          <span className="text-xs font-mono opacity-70">{fmtTime(currentTime)} / {fmtTime(duration)}</span>

          <div className="flex-1" />

          {/* Mark button — quick bookmark at current time */}
          <button onClick={() => {
            const id = `vid-${Date.now()}`;
            setMarkers((prev) => [...prev, { id, time: currentTime, label: `Mark @ ${fmtTime(currentTime)}`, color: "#F1D7FF" }]);
            toast.success("Marked", `Bookmark at ${fmtTime(currentTime)}`);
          }} className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium hover:bg-white/10 min-touch" title="Quick mark at current time">
            <Bookmark size={13} /> Mark
          </button>

          {/* Code button — single-point coded segment */}
          <button onClick={() => {
            const id = `vid-${Date.now()}`;
            const color = "#4CAF50";
            const segName = `${title} @ ${fmtTime(currentTime)}`;
            setMarkers((prev) => [...prev, { id, time: currentTime, label: segName, color }]);
            addCategory({ id, name: segName, color, parentId: null, count: 1, description: `Video: ${title} at ${fmtTime(currentTime)}` });
            toast.success("Coded", `Segment at ${fmtTime(currentTime)} — view in Codes panel`);
          }} className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium hover:bg-white/10 min-touch" title="Code at current time">
            <Tag size={13} /> Code
          </button>

          {/* Screenshot button */}
          <button onClick={handleScreenshot} className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium hover:bg-white/10 min-touch" title="Capture frame as document">
            <Camera size={13} /> Capture
          </button>

          {/* Transcribe / TTS buttons */}
          <button onClick={() => setShowTranscribe(true)} className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium hover:bg-white/10 min-touch" title="Transcribe this video">
            <FileText size={13} /> Transcribe
          </button>
          <button onClick={() => openTTS(`Video: ${title}`)} className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium hover:bg-white/10 min-touch" title="Read title aloud">
            <Volume1 size={13} /> TTS
          </button>

          <button onClick={toggleFullscreen} className="rounded p-1 hover:bg-white/10 min-touch" aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>

        {/* Drag instruction */}
        <p className="mt-1 text-center text-[9px] opacity-30">Drag on timeline to select a range · Click to seek</p>
      </div>

      {/* Center play button */}
      {!playing && (
        <button onClick={handlePlayPause} className="absolute flex h-16 w-16 items-center justify-center rounded-full bg-white/20 transition-transform hover:scale-110" aria-label="Play">
          <Play size={28} fill="white" color="white" className="ml-1.5" />
        </button>
      )}

      {/* Coding panel (appears after drag-to-select) */}
      {showCodingPanel && selStart !== null && selEnd !== null && (
        <div className="absolute bottom-20 left-4 z-50 w-[320px] rounded-lg p-4 shadow-xl"
          style={{ backgroundColor: "var(--bg-panel)", border: "1px solid var(--border)" }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              Code segment · {fmtTime(Math.min(selStart, selEnd))}–{fmtTime(Math.max(selStart, selEnd))}
            </span>
            <button onClick={() => { setShowCodingPanel(false); setSelStart(null); setSelEnd(null); }} className="rounded p-0.5 hover:bg-gray-100"><X size={14} /></button>
          </div>
          <input value={segmentName} onChange={(e) => setSegmentName(e.target.value)}
            placeholder="Segment name (required)" autoFocus
            onMouseDown={(e) => e.stopPropagation()}
            className="mb-2 w-full rounded border px-2.5 py-1.5 text-xs outline-none"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
          {/* Category combobox — type to create new, click to select existing */}
          <div className="relative mb-2" onMouseDown={(e) => e.stopPropagation()}>
            <input value={segmentCategory} onChange={(e) => { setSegmentCategory(e.target.value); setShowCatDropdown(true); }}
              onFocus={() => setShowCatDropdown(true)}
              onBlur={() => setTimeout(() => setShowCatDropdown(false), 200)}
              placeholder="Category — type new or select existing"
              className="w-full rounded border px-2.5 py-1.5 text-xs outline-none"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
            />
            {showCatDropdown && projectCategories.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-0.5 max-h-[140px] overflow-y-auto rounded-md border bg-white shadow-lg"
                style={{ borderColor: "var(--border)" }}>
                {projectCategories
                  .filter((c) => !segmentCategory || c.name.toLowerCase().includes(segmentCategory.toLowerCase()))
                  .slice(0, 8)
                  .map((cat) => (
                    <button key={cat.id}
                      onMouseDown={(e) => { e.preventDefault(); setSegmentCategory(cat.name); setShowCatDropdown(false); }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-gray-100"
                      style={{ color: "var(--text-primary)" }}>
                      <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="truncate">{cat.name}</span>
                    </button>
                  ))}
                {segmentCategory && !projectCategories.some((c) => c.name.toLowerCase() === segmentCategory.toLowerCase()) && (
                  <div className="px-2.5 py-1.5 text-xs opacity-40 italic">Press Save to create "{segmentCategory}"</div>
                )}
              </div>
            )}
          </div>
          <textarea value={segmentComment} onChange={(e) => setSegmentComment(e.target.value)}
            placeholder="Comment (optional)" rows={2}
            onMouseDown={(e) => e.stopPropagation()}
            className="mb-3 w-full resize-none rounded border px-2.5 py-1.5 text-xs outline-none"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowCodingPanel(false); setSelStart(null); setSelEnd(null); }}
              className="rounded border px-3 py-1.5 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Cancel</button>
            <button onClick={handleSaveSegment} disabled={!segmentName.trim()}
              className="flex items-center gap-1 rounded-md bg-peach-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-peach-700 disabled:opacity-40">
              <Save size={12} /> Save segment
            </button>
          </div>
        </div>
      )}

      {/* Markers list below player */}
      {markers.length > 0 && (
        <div className="flex-shrink-0 border-t px-3 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)", maxHeight: 120, overflowY: "auto" }}>
          <p className="mb-1 text-[10px] font-semibold opacity-40">Coded segments ({Math.ceil(markers.length / 2)})</p>
          {markers.filter((m) => !m.id.endsWith("-end")).map((m) => {
            const endMarker = markers.find((em) => em.id === `${m.id}-end`);
            return (
              <div key={m.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-gray-50 cursor-pointer"
                onClick={() => { if (videoRef.current) videoRef.current.currentTime = m.time; }}
                style={{ color: "var(--text-primary)" }}>
                <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                <span className="flex-1 truncate font-medium">{m.label}</span>
                <span className="text-[10px] font-mono opacity-40">{fmtTime(m.time)}{endMarker ? `–${fmtTime(endMarker.time)}` : ""}</span>
                {m.comment && <span className="text-[10px] opacity-30 truncate max-w-[100px]">{m.comment}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
    {/* ── Whisper transcription modal ── */}
    <WhisperTranscriber
      open={showTranscribe}
      documentId={documentId}
      documentName={title}
      audioSrc={src}
      duration={duration}
      onClose={() => setShowTranscribe(false)}
      onTranscriptionReady={(text, speakers) => {
        setShowTranscribe(false);
        setPendingTranscriptText(text);
        setPendingTranscriptSpeakers(speakers);
        setTranscriptDocName(`Transcripción: ${title}`);
        setShowSaveDialog(true);
      }}
    />

    {/* ── Save transcription as document dialog ── */}
    {showSaveDialog && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSaveDialog(false)}>
        <div className="w-full max-w-sm rounded-xl p-5 shadow-xl" style={{ backgroundColor: "var(--bg-panel)" }} onClick={(e) => e.stopPropagation()}>
          <h3 className="mb-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            ¿Guardar transcripción como documento?
          </h3>
          <p className="mb-3 text-[11px] opacity-50" style={{ color: "var(--text-secondary)" }}>
            La transcripción se guardará como un nuevo documento de texto en el proyecto.
          </p>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider opacity-40" style={{ color: "var(--text-secondary)" }}>
            Nombre del documento
          </label>
          <input
            value={transcriptDocName}
            onChange={(e) => setTranscriptDocName(e.target.value)}
            autoFocus
            className="mb-4 w-full rounded-md border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
            onKeyDown={(e) => { if (e.key === "Enter") handleConfirmSaveTranscript(); }}
          />
          <p className="mb-3 text-[10px] opacity-30" style={{ color: "var(--text-secondary)" }}>
            {pendingTranscriptText.slice(0, 150)}{pendingTranscriptText.length > 150 ? "..." : ""}
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => {
              setShowSaveDialog(false);
              // Save as memo instead
              const memoContent = pendingTranscriptText.slice(0, 5000);
              addMemo({
                id: `memo-trans-${Date.now()}`,
                title: transcriptDocName || `Transcripción: ${title}`,
                content: memoContent,
                linkedDocIds: documentId ? [documentId] : [],
                linkedCodeIds: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              toast.success("Transcripción guardada", "Revisa la transcripción en la pestaña Memos");
              setPendingTranscriptText("");
            }} className="rounded-md border px-3 py-1.5 text-xs min-touch"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
              Guardar como memo
            </button>
            <button onClick={handleConfirmSaveTranscript}
              className="flex items-center gap-1 rounded-md bg-peach-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-peach-700 min-touch">
              <Plus size={12} /> Guardar como documento
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default VideoPlayer;
