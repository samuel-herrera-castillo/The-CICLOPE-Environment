import { useState, useCallback } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

interface TranscriptorProps {
  /** Called with the transcription result */
  onTranscript: (text: string) => void;
}

/**
 * Audio transcription trigger.
 *
 * Sends audio to the local Whisper model and returns the transcribed text.
 */
export function Transcriptor({ onTranscript }: TranscriptorProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      // Stop recording → transcribe
      setRecording(false);
      setTranscribing(true);
      setProgress(0);

      // Simulated: in production this would feed the audio buffer to Whisper
      const interval = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            clearInterval(interval);
            setTranscribing(false);
            onTranscript("[Transcription placeholder — Whisper model not yet wired]");
            return 100;
          }
          return p + 10;
        });
      }, 200);
    } else {
      // Start recording
      setRecording(true);
    }
  }, [recording, onTranscript]);

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      {/* Record button */}
      <button
        onClick={toggleRecording}
        disabled={transcribing}
        className={`flex h-16 w-16 items-center justify-center rounded-full transition-all min-touch ${
          recording
            ? "bg-red-500 text-white animate-pulse"
            : "bg-peach-500 text-white hover:bg-peach-700"
        } disabled:opacity-50`}
        aria-label={recording ? "Stop recording" : "Start recording"}
      >
        {recording ? <Square size={24} /> : <Mic size={24} />}
      </button>

      {/* Label */}
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        {recording
          ? "Recording..."
          : transcribing
            ? "Transcribing..."
            : "Tap to record"}
      </p>

      {/* Progress bar during transcription */}
      {transcribing && (
        <div className="flex w-48 items-center gap-3">
          <Loader2 size={14} className="animate-spin text-peach-500" />
          <div className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: "var(--border)" }}>
            <div
              className="h-full rounded-full bg-peach-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs opacity-50">{progress}%</span>
        </div>
      )}
    </div>
  );
}

export default Transcriptor;
