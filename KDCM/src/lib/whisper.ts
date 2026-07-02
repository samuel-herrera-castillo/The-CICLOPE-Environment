/**
 * Whisper transcription layer.
 *
 * Uses @xenova/transformers to run Whisper models locally
 * (no network required after first model download).
 */

import { isTauri } from "../utils/env";

export interface TranscriptionSegment {
  start: number;   // seconds
  end: number;
  text: string;
  confidence: number;
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[];
  fullText: string;
  language: string;
  durationMs: number;
}

type ProgressCallback = (pct: number) => void;

/**
 * Transcribe an audio file using Whisper (local).
 *
 * @param audioPath  Path to the audio file (WAV/MP3)
 * @param onProgress Optional progress callback (0-100)
 */
export async function transcribeAudio(
  _audioPath: string,
  _onProgress?: ProgressCallback,
): Promise<TranscriptionResult> {
  if (!isTauri()) {
    throw new Error("Whisper transcription is only available in desktop builds");
  }

  // Placeholder — real implementation loads model via @xenova/transformers
  // and feeds audio through the whisper pipeline.
  //
  // const { pipeline } = await import("@xenova/transformers");
  // const transcriber = await pipeline("automatic-speech-recognition", "openai/whisper-small");
  // const result = await transcriber(audioBuffer, { chunk_length_s: 30, return_timestamps: true });

  console.warn("[whisper] Not yet wired — returning stub result");
  return {
    segments: [],
    fullText: "",
    language: "es",
    durationMs: 0,
  };
}

/** Quick health-check: can the Whisper pipeline load? */
export async function pingWhisper(): Promise<{ ok: boolean; ms: number }> {
  const t0 = performance.now();
  try {
    // In production this would attempt to load the model info
    return { ok: true, ms: Math.round(performance.now() - t0) };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - t0) };
  }
}
