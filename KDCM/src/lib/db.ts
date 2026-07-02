/**
 * SQLite database layer (better-sqlite3).
 *
 * Only available in Tauri desktop builds. In web mode, all DB
 * operations fall back to Supabase or IndexedDB.
 */

import { isTauri } from "../utils/env";

type QueryResult<T = unknown> = {
  data: T[];
  error: string | null;
};

let dbInstance: unknown = null;

/**
 * Lazy-init the SQLite connection.
 * In Tauri, this opens the database file in the app data directory.
 */
async function getDb(): Promise<unknown> {
  if (!isTauri()) throw new Error("SQLite is only available in Tauri desktop builds");
  if (dbInstance) return dbInstance;

  try {
    // better-sqlite3 is a native module — imported dynamically to avoid
    // web build errors
    const Database = (await import("better-sqlite3")).default;
    // In Tauri v2, access app data dir via @tauri-apps/api/path
    const { appDataDir } = await import("@tauri-apps/api/path");
    const { join } = await import("@tauri-apps/api/path");
    const dir = await appDataDir();
    const dbPath = await join(dir, "kdcm.db");

    dbInstance = new Database(dbPath);
    // Enable WAL mode for better concurrent read performance
    (dbInstance as any).pragma("journal_mode = WAL");
    return dbInstance;
  } catch (err) {
    console.error("[db] Failed to open SQLite:", err);
    throw err;
  }
}

/** Run a SQL query and return rows */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  try {
    const db = await getDb();
    const stmt = (db as any).prepare(sql);
    const data = params.length > 0 ? stmt.all(...params) : stmt.all();
    return { data: data as T[], error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[db] Query error:", msg, sql);
    return { data: [], error: msg };
  }
}

/** Run a SQL statement (INSERT/UPDATE/DELETE) and return changes */
export async function execute(
  sql: string,
  params: unknown[] = [],
): Promise<{ changes: number; error: string | null }> {
  try {
    const db = await getDb();
    const stmt = (db as any).prepare(sql);
    const result = params.length > 0 ? stmt.run(...params) : stmt.run();
    return { changes: (result as any).changes ?? 0, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[db] Execute error:", msg, sql);
    return { changes: 0, error: msg };
  }
}

/** Run schema migrations from src-tauri/src/db/migrations/ */
export async function runMigrations(): Promise<void> {
  try {
    const db = await getDb();
    // Ensure migrations table exists
    (db as any).exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    // Migration discovery would scan migrations/ folder at build time.
    // For now this is a stub — actual file scanning needs Tauri fs APIs.
    console.log("[db] Migrations table ready");
  } catch (err) {
    console.error("[db] Migration error:", err);
  }
}

/** Check if SQLite is available and responsive */
export async function pingDb(): Promise<{ ok: boolean; ms: number }> {
  const t0 = performance.now();
  try {
    const db = await getDb();
    (db as any).prepare("SELECT 1").get();
    return { ok: true, ms: Math.round(performance.now() - t0) };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - t0) };
  }
}

export { getDb };
