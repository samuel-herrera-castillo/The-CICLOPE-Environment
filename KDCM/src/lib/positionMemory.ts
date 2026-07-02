/**
 * Position memory — saves/restores document position (page, scroll, zoom) in SQLite.
 * Falls back to localStorage when Tauri is not available.
 *
 * Debounce: page 500ms, scroll 1000ms, zoom immediate.
 * Fallback localStorage key: pos_[proyectoId]_[docId]
 */
import { savePosition as bridgeSave, getPosition as bridgeGet } from "./tauriBridge";

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function debounce(key: string, fn: () => void, ms: number) {
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    debounceTimers.delete(key);
    fn();
  }, ms);
  debounceTimers.set(key, timer);
}

/** Cached last-known position to preserve values across partial saves */
const positionCache = new Map<string, { pagina: number; scrollY: number; zoom: number }>();

export async function savePosition(
  docId: string,
  proyectoId: string,
  data: { pagina: number; scrollY: number; zoom: number },
) {
  const cacheKey = `${proyectoId}_${docId}`;
  positionCache.set(cacheKey, data);
  bridgeSave(docId, proyectoId, data.pagina, data.scrollY, data.zoom).catch(() => {});
  // Fallback localStorage
  try {
    const key = `pos_${proyectoId}_${docId}`;
    localStorage.setItem(key, JSON.stringify({ ...data, timestamp_apertura: new Date().toISOString() }));
  } catch { /* */ }
}

export function savePositionDebounced(
  docId: string,
  proyectoId: string,
  data: { pagina: number; scrollY: number; zoom: number },
) {
  const key = `pos_${docId}`;
  debounce(key, () => savePosition(docId, proyectoId, data), 800);
}

export async function getPosition(
  docId: string,
  proyectoId: string,
): Promise<{ pagina: number; scroll_y: number; zoom: number; timestamp_apertura?: string } | null> {
  try {
    const result = await bridgeGet(docId, proyectoId);
    if (result && typeof result.pagina !== "undefined") return result;
    // Fallback localStorage
    const key = `pos_${proyectoId}_${docId}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { pagina: parsed.pagina || 1, scroll_y: parsed.scrollY || 0, zoom: parsed.zoom || 1, timestamp_apertura: parsed.timestamp_apertura };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPosition(docId: string, proyectoId: string) {
  positionCache.delete(`${proyectoId}_${docId}`);
  try {
    localStorage.removeItem(`pos_${proyectoId}_${docId}`);
  } catch { /* */ }
}

import { useEffect } from "react";

export function usePositionMemory(
  docId: string | undefined,
  proyectoId: string | undefined,
) {
  // Save timestamp_apertura on mount
  useEffect(() => {
    if (!docId || !proyectoId) return;
    const cacheKey = `${proyectoId}_${docId}`;
    const now = new Date().toISOString();
    try {
      const key = `pos_${proyectoId}_${docId}`;
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : { pagina: 1, scrollY: 0, zoom: 1 };
      data.timestamp_apertura = now;
      localStorage.setItem(key, JSON.stringify(data));
    } catch { /* */ }
    getPosition(docId, proyectoId).then((pos) => {
      if (pos) {
        positionCache.set(cacheKey, { pagina: pos.pagina || 1, scrollY: pos.scroll_y || 0, zoom: pos.zoom || 1 });
      }
    });
  }, [docId, proyectoId]);

  return {
    restorePosition: async () => {
      if (!docId || !proyectoId) return null;
      return getPosition(docId, proyectoId);
    },
    /** Save page with 500ms debounce. Preserves current scrollY and zoom from cache. */
    savePage: (pagina: number, scrollY: number, zoom: number) => {
      if (!docId || !proyectoId) return;
      const cacheKey = `${proyectoId}_${docId}`;
      positionCache.set(cacheKey, { pagina, scrollY, zoom });
      const key = `pos_${docId}_page`;
      debounce(key, () => savePosition(docId, proyectoId, { pagina, scrollY, zoom }), 500);
    },
    /** Save scroll with 1000ms debounce. Preserves current page and zoom from cache. */
    saveScroll: (scrollY: number) => {
      if (!docId || !proyectoId) return;
      const cacheKey = `${proyectoId}_${docId}`;
      const cached = positionCache.get(cacheKey);
      const pagina = cached?.pagina || 1;
      const zoom = cached?.zoom || 1;
      positionCache.set(cacheKey, { pagina, scrollY, zoom });
      const key = `pos_${docId}_scroll`;
      debounce(key, () => savePosition(docId, proyectoId, { pagina, scrollY, zoom }), 1000);
    },
    /** Save zoom immediately. Preserves current page and scrollY from cache. */
    saveZoom: (zoom: number) => {
      if (!docId || !proyectoId) return;
      const cacheKey = `${proyectoId}_${docId}`;
      const cached = positionCache.get(cacheKey);
      const pagina = cached?.pagina || 1;
      const scrollY = cached?.scrollY || 0;
      positionCache.set(cacheKey, { pagina, scrollY, zoom });
      savePosition(docId, proyectoId, { pagina, scrollY, zoom });
    },
    /** Flush all pending debounced saves immediately (call on unmount) */
    flushPosition: () => {
      debounceTimers.forEach((timer, key) => {
        clearTimeout(timer);
        debounceTimers.delete(key);
      });
      if (!docId || !proyectoId) return;
      const cacheKey = `${proyectoId}_${docId}`;
      const cached = positionCache.get(cacheKey);
      if (cached) {
        savePosition(docId, proyectoId, cached);
      }
    },
  };
}
