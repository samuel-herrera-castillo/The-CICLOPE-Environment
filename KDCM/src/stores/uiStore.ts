import { create } from "zustand";

export type ErrorType = "sqlite" | "supabase" | "general";

export interface AppError {
  type: ErrorType;
  message: string;
}

export type Theme = "system" | "light" | "dark";

/** A single undoable action */
export interface UndoAction {
  id: string;
  type: string;
  label: string;
  payload: unknown;
  timestamp: string;
}

interface UIState {
  appLoading: boolean;
  error: AppError | null;
  diagnosticOpen: boolean;
  collaborativeSession: boolean;
  theme: Theme;
  /** Focus mode (F11) — hides side panels */
  focusMode: boolean;
  /** Undo stack (max 50 actions) */
  undoStack: UndoAction[];
  redoStack: UndoAction[];
  /** Currently inspected segment data (shown in right panel Inspector) */
  inspectedSegment: { id: string; text: string; docName: string; authorName: string; authorColor: string } | null;

  setAppLoading: (loading: boolean) => void;
  setError: (error: AppError | null) => void;
  clearError: () => void;
  openDiagnostic: () => void;
  closeDiagnostic: () => void;
  setCollaborativeSession: (active: boolean) => void;
  setTheme: (theme: Theme) => void;
  toggleFocusMode: () => void;
  pushUndo: (action: UndoAction) => void;
  popUndo: () => UndoAction | null;
  pushRedo: (action: UndoAction) => void;
  popRedo: () => UndoAction | null;
  clearUndoHistory: () => void;
  setInspectedSegment: (seg: UIState["inspectedSegment"]) => void;
}

let undoCounter = 0;
const MAX_UNDO = 50;

export const useUIStore = create<UIState>((set, get) => ({
  appLoading: false,
  error: null,
  diagnosticOpen: false,
  collaborativeSession: false,
  theme: "system",
  focusMode: false,
  undoStack: [],
  redoStack: [],
  inspectedSegment: null,

  setAppLoading: (loading) => set({ appLoading: loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  openDiagnostic: () => set({ diagnosticOpen: true }),
  closeDiagnostic: () => set({ diagnosticOpen: false }),
  setCollaborativeSession: (active) => set({ collaborativeSession: active }),
  setTheme: (theme) => set({ theme }),

  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),

  pushUndo: (action) => {
    const a: UndoAction = { ...action, id: `undo-${++undoCounter}`, timestamp: new Date().toISOString() };
    set((s) => {
      const next = [...s.undoStack, a];
      if (next.length > MAX_UNDO) next.shift();
      return { undoStack: next, redoStack: [] };
    });
  },

  popUndo: () => {
    const stack = get().undoStack;
    if (stack.length === 0) return null;
    const action = stack[stack.length - 1];
    set((s) => ({ undoStack: s.undoStack.slice(0, -1) }));
    return action;
  },

  pushRedo: (action) => {
    set((s) => {
      const next = [...s.redoStack, action];
      if (next.length > MAX_UNDO) next.shift();
      return { redoStack: next };
    });
  },

  popRedo: () => {
    const stack = get().redoStack;
    if (stack.length === 0) return null;
    const action = stack[stack.length - 1];
    set((s) => ({ redoStack: s.redoStack.slice(0, -1) }));
    return action;
  },

  clearUndoHistory: () => set({ undoStack: [], redoStack: [] }),
  setInspectedSegment: (seg) => set({ inspectedSegment: seg }),
}));
