import { create } from "zustand";

export interface FilterState {
  filtroDocumento: string[];
  filtroCodigo: string[];
  filtroInvestigador: string | null;
  filtroFechaDesde: string | null;
  filtroFechaHasta: string | null;
  filtrosPausados: string[];

  setFiltroDocumento: (ids: string[]) => void;
  setFiltroCodigo: (ids: string[]) => void;
  setFiltroInvestigador: (id: string | null) => void;
  setFiltroFechaDesde: (f: string | null) => void;
  setFiltroFechaHasta: (f: string | null) => void;
  clearAll: () => void;
  pausarFiltro: (id: string) => void;
  reanudarFiltro: (id: string) => void;
  filtrosActivos: () => number;
}

export const useFilterStore = create<FilterState>((set, get) => ({
  filtroDocumento: [],
  filtroCodigo: [],
  filtroInvestigador: null,
  filtroFechaDesde: null,
  filtroFechaHasta: null,
  filtrosPausados: [],

  setFiltroDocumento: (ids) => set({ filtroDocumento: ids }),
  setFiltroCodigo: (ids) => set({ filtroCodigo: ids }),
  setFiltroInvestigador: (id) => set({ filtroInvestigador: id }),
  setFiltroFechaDesde: (f) => set({ filtroFechaDesde: f }),
  setFiltroFechaHasta: (f) => set({ filtroFechaHasta: f }),

  clearAll: () =>
    set({
      filtroDocumento: [],
      filtroCodigo: [],
      filtroInvestigador: null,
      filtroFechaDesde: null,
      filtroFechaHasta: null,
      filtrosPausados: [],
    }),

  pausarFiltro: (id) =>
    set((s) => ({
      filtrosPausados: [...s.filtrosPausados, id],
    })),

  reanudarFiltro: (id) =>
    set((s) => ({
      filtrosPausados: s.filtrosPausados.filter((fid) => fid !== id),
    })),

  filtrosActivos: () => {
    const s = get();
    let count = 0;
    count += s.filtroDocumento.filter((id) => !s.filtrosPausados.includes(id)).length;
    count += s.filtroCodigo.filter((id) => !s.filtrosPausados.includes(id)).length;
    if (s.filtroInvestigador && !s.filtrosPausados.includes(s.filtroInvestigador)) count++;
    if (s.filtroFechaDesde && !s.filtrosPausados.includes("fechaDesde")) count++;
    if (s.filtroFechaHasta && !s.filtrosPausados.includes("fechaHasta")) count++;
    return count;
  },
}));
