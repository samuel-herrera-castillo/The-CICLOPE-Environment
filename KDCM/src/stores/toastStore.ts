import { create } from "zustand";

export type ToastType = "success" | "warning" | "error" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  /** Auto-dismiss duration in ms. 0 = persists until manually dismissed. */
  duration: number;
}

const MAX_TOASTS = 3;

/** Per-type defaults */
const DEFAULTS: Record<ToastType, { duration: number }> = {
  success: { duration: 4000 },
  warning: { duration: 6000 },
  error:   { duration: 0 },      // no auto-close
  info:    { duration: 4000 },
};

let counter = 0;

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;

  /** Convenience shorthands */
  success: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  error:   (title: string, message?: string) => string;
  info:    (title: string, message?: string) => string;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  addToast: (partial) => {
    const id = `toast-${++counter}-${Date.now()}`;
    const toast: Toast = { ...partial, id };

    set((s) => {
      const next = [...s.toasts, toast];
      // Keep only the last MAX_TOASTS (oldest dropped)
      while (next.length > MAX_TOASTS) next.shift();
      return { toasts: next };
    });

    // Auto-dismiss
    if (toast.duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, toast.duration);
    }

    return id;
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  success: (title, message) =>
    get().addToast({ type: "success", title, message, duration: DEFAULTS.success.duration }),

  warning: (title, message) =>
    get().addToast({ type: "warning", title, message, duration: DEFAULTS.warning.duration }),

  error: (title, message) =>
    get().addToast({ type: "error", title, message, duration: DEFAULTS.error.duration }),

  info: (title, message) =>
    get().addToast({ type: "info", title, message, duration: DEFAULTS.info.duration }),
}));

/** Hook alias — useToast() → { toast } */
export function useToast() {
  const addToast = useToastStore((s) => s.addToast);
  const removeToast = useToastStore((s) => s.removeToast);

  return {
    toast: {
      success: useToastStore.getState().success,
      warning: useToastStore.getState().warning,
      error:   useToastStore.getState().error,
      info:    useToastStore.getState().info,
      dismiss: removeToast,
      add:     addToast,
    },
  } as const;
}
