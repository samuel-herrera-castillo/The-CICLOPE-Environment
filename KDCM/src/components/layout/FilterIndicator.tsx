import { useState } from "react";
import { X, Play, EyeOff } from "lucide-react";
import { useFilterStore } from "../../stores/filterStore";

export type FilterType = "docs" | "categorias" | "investigador";

export interface ActiveFilter {
  type: FilterType;
  label: string;
}


/**
 * Thin 4px filter indicator bar shown below the navbar.
 * Uses filterStore for real filter state.
 */
export function FilterIndicator() {
  const filters = useFilterStore();
  const [showDropdown, setShowDropdown] = useState(false);

  const totalActive = filters.filtrosActivos();
  if (totalActive === 0) return null;

  const segments = [
    { label: "Docs", count: filters.filtroDocumento.length, color: "#2196F3" },
    { label: "Codes", count: filters.filtroCodigo.length, color: "#4CAF50" },
    { label: "Researcher", count: filters.filtroInvestigador ? 1 : 0, color: "#9C27B0" },
    { label: "Date", count: (filters.filtroFechaDesde || filters.filtroFechaHasta) ? 1 : 0, color: "#FF9800" },
  ].filter((s) => s.count > 0);

  const allFilterChips: { id: string; label: string; color: string; paused: boolean }[] = [
    ...filters.filtroDocumento.map((id) => ({ id, label: `Doc: ${id.slice(0, 20)}`, color: "#2196F3", paused: filters.filtrosPausados.includes(id) })),
    ...filters.filtroCodigo.map((id) => ({ id, label: `Code: ${id.slice(0, 20)}`, color: "#4CAF50", paused: filters.filtrosPausados.includes(id) })),
    ...(filters.filtroInvestigador ? [{ id: filters.filtroInvestigador, label: `Researcher: ${filters.filtroInvestigador.slice(0, 20)}`, color: "#9C27B0", paused: filters.filtrosPausados.includes(filters.filtroInvestigador) }] : []),
    ...(filters.filtroFechaDesde ? [{ id: "fechaDesde", label: `From: ${filters.filtroFechaDesde}`, color: "#FF9800", paused: filters.filtrosPausados.includes("fechaDesde") }] : []),
    ...(filters.filtroFechaHasta ? [{ id: "fechaHasta", label: `To: ${filters.filtroFechaHasta}`, color: "#FF9800", paused: filters.filtrosPausados.includes("fechaHasta") }] : []),
  ];

  const removeFilter = (id: string, color: string) => {
    if (color === "#2196F3") {
      filters.setFiltroDocumento(filters.filtroDocumento.filter((did) => did !== id));
    } else if (color === "#4CAF50") {
      filters.setFiltroCodigo(filters.filtroCodigo.filter((cid) => cid !== id));
    } else if (color === "#9C27B0") {
      filters.setFiltroInvestigador(null);
    } else if (color === "#FF9800") {
      if (id === "fechaDesde") filters.setFiltroFechaDesde(null);
      if (id === "fechaHasta") filters.setFiltroFechaHasta(null);
    }
  };

  return (
    <div className="relative" role="status" aria-label="Active filters">
      {/* Colored bar */}
      <div
        className="flex h-[4px] w-full cursor-pointer"
        onMouseEnter={() => setShowDropdown(true)}
        onMouseLeave={() => setShowDropdown(false)}
      >
        {segments.map((seg) => (
          <div
            key={seg.label}
            className="flex-1 transition-opacity hover:opacity-80"
            style={{ backgroundColor: seg.color, opacity: 0.8 }}
            title={`${seg.label}: ${seg.count} active`}
          />
        ))}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-full z-50 mx-2 mt-1 rounded-lg border p-3 shadow-xl"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}
          onMouseEnter={() => setShowDropdown(true)}
          onMouseLeave={() => setShowDropdown(false)}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              Active filters ({totalActive})
            </span>
            <button
              onClick={() => filters.clearAll()}
              className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700"
            >
              <X size={12} />
              Remove all
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allFilterChips.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium"
                style={{
                  backgroundColor: f.color + "20",
                  color: f.color,
                  border: `1px solid ${f.color}40`,
                  opacity: f.paused ? 0.5 : 1,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: f.color }} />
                <span className="max-w-[100px] truncate">{f.label}</span>
                {f.paused ? (
                  <button onClick={() => filters.reanudarFiltro(f.id)} className="ml-0.5 rounded p-0.5 hover:bg-white/20" title="Resume">
                    <Play size={9} />
                  </button>
                ) : (
                  <button onClick={() => filters.pausarFiltro(f.id)} className="ml-0.5 rounded p-0.5 hover:bg-white/20" title="Pause">
                    <EyeOff size={9} />
                  </button>
                )}
                <button onClick={() => removeFilter(f.id, f.color)} className="ml-0.5 rounded p-0.5 hover:bg-white/20" title="Remove">
                  <X size={9} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterIndicator;
