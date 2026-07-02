/**
 * SyncManager — handles synchronization of changes between researchers.
 * Defines which changes are synced and how they are applied to local SQLite.
 */

import { execQuery, saveCitation, saveCategory, saveMemo, saveNetwork } from "./tauriBridge";
import { useCollabStore } from "../stores/collabStore";

export interface SyncChange {
  tipo: "cita_nueva" | "cita_modificada" | "cita_eliminada" | "cita_categorizada" |
        "codigo_nuevo" | "codigo_modificado" | "memo_guardado" |
        "cursor_movido" | "red_modificada";
  datos: any;
  investigadorId: string;
  timestamp: number;
  checksum: string;
}

// Conflict resolution: last-write-wins with notification
const changeTimestamps = new Map<string, number>();

export async function applyRemoteChange(change: SyncChange): Promise<void> {
  const key = `${change.tipo}:${change.datos?.id || "unknown"}`;
  const localTs = changeTimestamps.get(key) || 0;

  if (change.timestamp < localTs) {
    // Local change is newer — notify remote user's change was rejected
    console.log(`[Sync] Local version is newer for ${key}, ignoring remote change`);
    return;
  }

  changeTimestamps.set(key, change.timestamp);

  try {
    switch (change.tipo) {
      case "cita_nueva": {
        const d = change.datos;
        if (d?.id && d?.documento_id) {
          await saveCitation(d.id, d.documento_id, d.texto || "", d.posicion_inicio || 0, d.posicion_fin || 0, d.pagina || 1);
        }
        break;
      }
      case "cita_modificada": {
        const d = change.datos;
        if (d?.id) {
          await execQuery("UPDATE citas SET posicion_inicio=?2, posicion_fin=?3, pagina=?4 WHERE id=?1",
            [d.id, d.posicion_inicio, d.posicion_fin, d.pagina]);
        }
        break;
      }
      case "cita_eliminada": {
        if (change.datos?.id) {
          await execQuery("DELETE FROM citas WHERE id=?1", [change.datos.id]);
          await execQuery("DELETE FROM citas_codigos WHERE cita_id=?1", [change.datos.id]);
        }
        break;
      }
      case "cita_categorizada": {
        const d = change.datos;
        if (d?.cita_id && d?.codigo_id) {
          const id = `cc-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
          await execQuery(
            "INSERT OR REPLACE INTO citas_codigos (id, cita_id, codigo_id, peso_codificacion, fecha) VALUES (?1,?2,?3,?4,?5)",
            [id, d.cita_id, d.codigo_id, d.peso || 50, new Date().toISOString()]);
        }
        break;
      }
      case "codigo_nuevo": {
        const d = change.datos;
        if (d?.id && d?.nombre) {
          await saveCategory(d.id, d.proyecto_id || "", d.nombre, d.color_hex || "#F1D7FF", d.descripcion || "", d.codigo_padre_id || null);
        }
        break;
      }
      case "codigo_modificado": {
        const d = change.datos;
        if (d?.id) {
          await execQuery("UPDATE codigos SET nombre=?2, color_hex=?3, descripcion=?4 WHERE id=?1",
            [d.id, d.nombre, d.color_hex, d.descripcion]);
        }
        break;
      }
      case "memo_guardado": {
        const d = change.datos;
        if (d?.id && d?.proyecto_id) {
          await saveMemo(d.id, d.proyecto_id, d.titulo || "", d.contenido_html || "", d.tipo_memo || "general");
        }
        break;
      }
      case "cursor_movido": {
        // No SQLite — only updates collabStore cursor position
        const { useCollabStore } = await import("../stores/collabStore");
        useCollabStore.getState().updateCursor(
          change.investigadorId,
          change.datos?.documento_id || "",
          change.datos?.posicion || 0
        );
        break;
      }
      case "red_modificada": {
        const d = change.datos;
        if (d?.id && d?.proyecto_id) {
          await saveNetwork(d.proyecto_id, d.id, d.nombre || "Network", d.datos_json || "{}", d.miniatura_svg || null);
        }
        break;
      }
    }
    // Notify activity
    useCollabStore.getState().addActivity(
      change.investigadorId || "Remote",
      `${change.tipo.replace(/_/g, " ")}`
    );
  } catch (e) {
    console.error(`[SyncManager] Failed to apply change ${change.tipo}:`, e);
  }
}

/**
 * Offline queue — stores changes when DataChannel is closed,
 * sends them on reconnection.
 */
let offlineQueue: SyncChange[] = [];

export function queueOfflineChange(change: SyncChange): void {
  offlineQueue.push(change);
  // Backup to localStorage
  try {
    const stored = JSON.parse(localStorage.getItem("kdcm-offline-queue") || "[]");
    stored.push(change);
    localStorage.setItem("kdcm-offline-queue", JSON.stringify(stored.slice(-500)));
  } catch {}
}

export function getOfflineQueue(): SyncChange[] {
  try {
    const stored = JSON.parse(localStorage.getItem("kdcm-offline-queue") || "[]");
    offlineQueue = stored;
  } catch {}
  return offlineQueue;
}

export function clearOfflineQueue(): void {
  offlineQueue = [];
  localStorage.removeItem("kdcm-offline-queue");
}

/**
 * Generate a checksum for data integrity verification.
 */
export function generateChecksum(data: any): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(16);
}
