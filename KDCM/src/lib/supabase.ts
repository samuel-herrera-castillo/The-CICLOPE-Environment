import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ── Singleton Supabase client ── */

let client: SupabaseClient | null = null;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Returns a Supabase client instance (lazy-init).
 * Falls back to warning if env vars are not set.
 */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn("[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — cloud sync disabled");
    return null;
  }
  client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}

/** Quick health-check ping */
export async function pingSupabase(): Promise<{ ok: boolean; ms: number }> {
  const t0 = performance.now();
  try {
    const sb = getSupabase();
    if (!sb) return { ok: false, ms: 0 };
    await sb.from("_health").select("*").limit(1).maybeSingle();
    return { ok: true, ms: Math.round(performance.now() - t0) };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - t0) };
  }
}
