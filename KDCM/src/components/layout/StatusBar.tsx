import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { useCollabStore } from "../../stores/collabStore";
import { useProjectStore } from "../../stores/projectStore";
import { useFilterStore } from "../../stores/filterStore";
import { isTauri } from "../../utils/env";

/** Browser storage estimate — returns percentage used (0-100). */
function useBrowserStorage(): number {
  const [pct, setPct] = useState<number>(() => {
    try {
      const cached = sessionStorage.getItem("kdcm-storage-pct");
      return cached ? Number(cached) : 0;
    } catch { return 0; }
  });

  useEffect(() => {
    if (isTauri()) return;
    const estimate = async () => {
      try {
        const est = await navigator.storage?.estimate?.();
        if (!est?.quota || est.quota === 0) return;
        const p = (est.usage ?? 0) / est.quota * 100;
        setPct(p);
        try { sessionStorage.setItem("kdcm-storage-pct", String(p)); } catch { /* */ }
      } catch { /* ignore */ }
    };
    estimate();
    const id = setInterval(estimate, 30_000);
    return () => clearInterval(id);
  }, []);

  return pct;
}

/**
 * Status bar — 28px, subtle background.
 *
 * Left:   Collaboration indicator + active filter chip
 * Center: Web storage bar (120px, only in browser)
 * Right:  Entity counts — docs, codes, citas, memos
 *
 * Offline banner takes priority when connectivity is lost.
 */
export function StatusBar() {
  const { t } = useTranslation("nav");
  const { isOnline } = useOnlineStatus();
  const session = useCollabStore((s) => s.session);
  const documents = useProjectStore((s) => s.documents);
  const categories = useProjectStore((s) => s.categories);
  const storagePct = useBrowserStorage();

  const filterActive = useFilterStore((s) => s.filtrosActivos());
  const clearFilters = useFilterStore((s) => s.clearAll);
  const docCount = documents.length;
  const codeCount = categories.length;
  const memoCount = useProjectStore((s) => s.memos.length);
  const citationCount = categories.reduce((s, c) => s + c.count, 0);

  /* ── Offline (web only) ── */
  if (!isOnline && !isTauri()) {
    return (
      <div
        className="flex h-[28px] items-center justify-center gap-2 px-4 text-xs font-medium no-print"
        style={{ backgroundColor: "rgba(241, 215, 255, 0.5)", color: "#C4A0D4" }}
        role="status"
        aria-live="polite"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
        {t("offline")}
        <span className="ml-2 opacity-40" style={{ fontSize: 10 }}>
          {t("n_docs", { count: docCount })} · {t("n_codes", { count: codeCount })}
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex h-[28px] items-center gap-3 px-4 text-xs no-print"
      style={{
        backgroundColor: "var(--bg-secondary, #f5f5f5)",
        color: "var(--text-secondary, #6b6b6b)",
        borderTop: "1px solid var(--border, #e5e5e5)",
      }}
      role="status"
      aria-label="Status bar"
    >
      {/* ── Left ── */}
      <div className="flex items-center gap-2">
        {/* Filter indicator chip */}
        {filterActive > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: "rgba(241, 215, 255, 0.3)", color: "#C4A0D4" }}>
            🔽 {t("filters_active", { count: filterActive })}
            <button onClick={() => { if (confirm("Quitar todos los filtros?")) clearFilters(); }}
              className="ml-0.5 rounded-full hover:bg-white/30 px-0.5" title="Quitar todos los filtros">✕</button>
          </span>
        )}
        {session ? (
          <span className="inline-flex items-center gap-1 font-medium" style={{ color: "#4CAF50" }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "#4CAF50" }} />
            {t("online")} · {session.participants.length + 1} {t("online")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 opacity-40">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--text-secondary)" }} />
            {t("local")}
          </span>
        )}
      </div>

      {/* ── Center: storage bar ── */}
      {!isTauri() && (
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-[120px] overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--border)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, storagePct)}%`,
                backgroundColor:
                  storagePct > 80 ? "#F44336" : storagePct > 60 ? "#F1D7FF" : "#4CAF50",
              }}
            />
          </div>
          <span className="font-mono opacity-50" style={{ fontSize: 10 }}>
            {Math.round(storagePct)}%
          </span>
        </div>
      )}

      <div className="flex-1" />

      {/* ── Right: counts ── */}
      <span className="opacity-50" style={{ fontSize: 11, fontFamily: "Inter, sans-serif" }}>
        {t("n_docs", { count: docCount })} · {t("n_codes", { count: codeCount })} · {t("n_citas", { count: citationCount })} · {t("n_memos", { count: memoCount })}
      </span>
    </div>
  );
}

export default StatusBar;
