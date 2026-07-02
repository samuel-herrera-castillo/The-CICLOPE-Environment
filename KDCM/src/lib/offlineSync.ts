/**
 * Offline sync queue backed by IndexedDB.
 *
 * When the app is offline, write operations are enqueued here.
 * On reconnection, the queue is drained and operations are replayed
 * against Supabase.
 */

export interface QueuedOp {
  id: string;
  table: string;
  action: "insert" | "update" | "delete";
  payload: unknown;
  timestamp: string;
  retries: number;
}

const DB_NAME = "kdcm_offline";
const STORE_NAME = "ops";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Enqueue an operation for later sync */
export async function enqueueOp(op: Omit<QueuedOp, "id" | "timestamp" | "retries">): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const record: QueuedOp = {
      ...op,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      retries: 0,
    };
    store.add(record);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error("[offline-sync] Failed to enqueue:", err);
  }
}

/** Get all pending operations */
export async function getPendingOps(): Promise<QueuedOp[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    const ops = await new Promise<QueuedOp[]>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return ops;
  } catch {
    return [];
  }
}

/** Remove a processed operation from the queue */
export async function dequeueOp(id: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error("[offline-sync] Failed to dequeue:", err);
  }
}

/** Get the count of pending operations */
export async function getPendingCount(): Promise<number> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).count();
    const count = await new Promise<number>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return count;
  } catch {
    return 0;
  }
}

/** Drain the queue by replaying operations against Supabase */
export async function drainQueue(syncFn: (op: QueuedOp) => Promise<boolean>): Promise<number> {
  const ops = await getPendingOps();
  let synced = 0;

  for (const op of ops) {
    try {
      const ok = await syncFn(op);
      if (ok) {
        await dequeueOp(op.id);
        synced++;
      }
    } catch {
      // Will retry on next drain
    }
  }

  return synced;
}
