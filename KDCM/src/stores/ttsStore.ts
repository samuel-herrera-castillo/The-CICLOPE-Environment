import { create } from "zustand";
import { persist } from "zustand/middleware";

// Module-level callbacks (non-serializable, not stored in zustand state)
let _onWordHighlight: ((charIndex: number) => void) | null = null;
let _onBoundary: ((charIndex: number, charLength: number) => void) | null = null;

export function setTTSWordHighlightCallback(cb: ((charIndex: number) => void) | null) { _onWordHighlight = cb; }
export function setTTSBoundaryCallback(cb: ((charIndex: number, charLength: number) => void) | null) { _onBoundary = cb; }
export function getTTSWordHighlightCallback() { return _onWordHighlight; }
export function getTTSBoundaryCallback() { return _onBoundary; }

export interface TTSState {
  isOpen: boolean;
  text: string | null;
  speed: number;
  pitch: number;
  volume: number;
  language: string;
  voiceName: string | null;
  open: (text: string) => void;
  close: () => void;
  setSpeed: (s: number) => void;
  setPitch: (p: number) => void;
  setVolume: (v: number) => void;
  setLanguage: (l: string) => void;
  setVoiceName: (v: string | null) => void;
}

export const useTTSStore = create<TTSState>()(
  persist(
    (set) => ({
      isOpen: false,
      text: null,
      speed: 1,
      pitch: 1,
      volume: 1,
      language: "es-ES",
      voiceName: null,
      open: (text) => set({ isOpen: true, text }),
      close: () => set({ isOpen: false, text: null }),
      setSpeed: (speed) => set({ speed }),
      setPitch: (pitch) => set({ pitch }),
      setVolume: (volume) => set({ volume }),
      setLanguage: (language) => set({ language }),
      setVoiceName: (voiceName: string | null) => set({ voiceName }),
    }),
    { name: "kdcm-tts" },
  ),
);
