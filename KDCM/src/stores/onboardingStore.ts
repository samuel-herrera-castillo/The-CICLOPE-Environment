import { create } from "zustand";

/* ── localStorage helpers ── */
const ONBOARDING_KEY = "kdcm_onboarding_done";
const SEEN_PREFIX = "kdcm_seen_";

function getBool(key: string, fallback = false): boolean {
  try { return localStorage.getItem(key) === "true"; } catch { return fallback; }
}
function setBool(key: string, val: boolean) {
  try { localStorage.setItem(key, String(val)); } catch { /* noop */ }
}

interface OnboardingState {
  /** Whether the full onboarding wizard has been completed */
  onboardingDone: boolean;
  /** Set of coach-mark IDs the user has already seen */
  seenMarks: Record<string, boolean>;

  /** Mark onboarding as complete */
  completeOnboarding: () => void;
  /** Reset onboarding (for testing / re-run) */
  resetOnboarding: () => void;
  /** Record that a coach mark has been seen */
  markSeen: (id: string) => void;
  /** Check whether a coach mark has been seen */
  hasSeen: (id: string) => boolean;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  onboardingDone: getBool(ONBOARDING_KEY),
  seenMarks: {},

  completeOnboarding: () => {
    setBool(ONBOARDING_KEY, true);
    set({ onboardingDone: true });
  },

  resetOnboarding: () => {
    setBool(ONBOARDING_KEY, false);
    set({ onboardingDone: false, seenMarks: {} });
  },

  markSeen: (id: string) => {
    const key = SEEN_PREFIX + id;
    setBool(key, true);
    set((s) => ({ seenMarks: { ...s.seenMarks, [id]: true } }));
  },

  hasSeen: (id: string) => {
    const seen = get().seenMarks;
    if (id in seen) return seen[id];
    const stored = getBool(SEEN_PREFIX + id);
    if (stored) {
      set((s) => ({ seenMarks: { ...s.seenMarks, [id]: true } }));
    }
    return stored;
  },
}));
