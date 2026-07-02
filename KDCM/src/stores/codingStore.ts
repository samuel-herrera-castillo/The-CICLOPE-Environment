import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CodingState {
  /** Last 5 used categories (for quick access chips) */
  recentCategories: string[];
  /** Last applied category ID (Ctrl+L) */
  lastCategoryId: string | null;
  /** Quick access slots 1-9 */
  quickSlots: (string | null)[];
  /** Currently selected segment IDs for mass categorization */
  selectedSegments: string[];
  /** Key evidence segment IDs */
  keyEvidence: string[];
  /** Whether key evidence filter is active */
  showOnlyKeyEvidence: boolean;
  /** Comments on segments. Key = segment marker ID */
  segmentComments: Record<string, { text: string; author: string; date: string }[]>;

  pushRecent: (catId: string) => void;
  setLastCategory: (catId: string) => void;
  setQuickSlot: (slot: number, catId: string) => void;
  toggleSegmentSelection: (segId: string) => void;
  clearSelection: () => void;
  toggleKeyEvidence: (segId: string) => void;
  toggleKeyEvidenceFilter: () => void;
  addSegmentComment: (segId: string, text: string, author: string) => void;
}

export const useCodingStore = create<CodingState>()(
  persist(
    (set) => ({
      recentCategories: [],
      lastCategoryId: null,
      quickSlots: Array(9).fill(null),
      selectedSegments: [],
      keyEvidence: [],
      showOnlyKeyEvidence: false,
      segmentComments: {},

      pushRecent: (catId) =>
        set((s) => {
          const filtered = s.recentCategories.filter((id) => id !== catId);
          const next = [catId, ...filtered].slice(0, 5);
          return { recentCategories: next, lastCategoryId: catId };
        }),

      setLastCategory: (catId) => set({ lastCategoryId: catId }),

      setQuickSlot: (slot, catId) =>
        set((s) => {
          const next = [...s.quickSlots];
          next[slot] = catId;
          return { quickSlots: next };
        }),

      toggleSegmentSelection: (segId) =>
        set((s) => {
          const exists = s.selectedSegments.includes(segId);
          return {
            selectedSegments: exists
              ? s.selectedSegments.filter((id) => id !== segId)
              : [...s.selectedSegments, segId],
          };
        }),

      clearSelection: () => set({ selectedSegments: [] }),

      toggleKeyEvidence: (segId) =>
        set((s) => {
          const exists = s.keyEvidence.includes(segId);
          return {
            keyEvidence: exists
              ? s.keyEvidence.filter((id) => id !== segId)
              : [...s.keyEvidence, segId],
          };
        }),

      toggleKeyEvidenceFilter: () =>
        set((s) => ({ showOnlyKeyEvidence: !s.showOnlyKeyEvidence })),

      addSegmentComment: (segId, text, author) =>
        set((s) => {
          const existing = s.segmentComments[segId] ?? [];
          return {
            segmentComments: {
              ...s.segmentComments,
              [segId]: [...existing, { text, author, date: new Date().toISOString() }],
            },
          };
        }),
    }),
    { name: "kdcm-coding" },
  ),
);
