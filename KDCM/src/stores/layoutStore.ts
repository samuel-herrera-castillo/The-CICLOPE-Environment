import { create } from "zustand";
import { persist } from "zustand/middleware";

/* ── Type definitions ── */

export type PestañaIzq = "docs" | "codigos" | "memos" | "variables";
export type VistaIzq = "arbol" | "lista" | "treemap" | "nube";
export type PestañaPrincipal = "documentos" | "analisis" | "visualizar" | "networks" | "mapas" | "equipo";

export interface ScrollPos {
  x: number;
  y: number;
}

export interface OpenTab {
  id: string;
  section: "analysis" | "visual";
  toolId: string;
  label: string;
  chartSubtype?: string;
}

interface LayoutState {
  /* ── Panel geometry ── */
  panelIzqAncho: number;
  panelDerAncho: number;
  panelIzqColapsado: boolean;
  panelDerColapsado: boolean;

  /* ── Left panel tabs / view ── */
  pestañaActivaIzq: PestañaIzq;
  vistaActivaIzq: VistaIzq;

  /* ── Document state ── */
  selectedDocId: string | null;
  highlightTarget: string | null; // JSON: {type, docId, ...} for memo→doc navigation
  ultimoDocumentoAbierto: { docId: string } | null;
  paginaDoc: Record<string, number>;
  zoomDoc: Record<string, number>;
  scrollDoc: Record<string, ScrollPos>;

  /* ── Main tab ── */
  pestañaPrincipal: PestañaPrincipal;

  /* ── Secondary bar ── */
  secondaryTab: string;
  setSecondaryTab: (tab: string) => void;

  /* ── Document open tabs ── */
  openDocIds: string[];
  openDoc: (id: string) => void;
  closeDoc: (id: string) => void;

  /* ── Center panel tabs (Analysis / Visual) ── */
  openTabs: OpenTab[];
  activeTabId: string | null;
  openTab: (tab: OpenTab) => void;
  closeTab: (id: string) => void;
  setActiveTabId: (id: string) => void;

  /* ── Actions ── */
  setPanelIzqAncho: (w: number) => void;
  setPanelDerAncho: (w: number) => void;
  togglePanelIzq: () => void;
  togglePanelDer: () => void;
  setPestañaActivaIzq: (t: PestañaIzq) => void;
  setVistaActivaIzq: (v: VistaIzq) => void;
  setSelectedDocId: (id: string | null) => void;
  setHighlightTarget: (target: string | null) => void;
  setUltimoDocumentoAbierto: (doc: { docId: string } | null) => void;
  setPaginaDoc: (docId: string, page: number) => void;
  setZoomDoc: (docId: string, zoom: number) => void;
  setScrollDoc: (docId: string, pos: ScrollPos) => void;
  setPestañaPrincipal: (t: PestañaPrincipal) => void;

  /** Restore all state from localStorage (called on project open) */
  hydrate: () => void;
  /** Persist all state to localStorage (called on app close) */
  flush: () => void;
}

const DEFAULT_PANEL_IZQ = 280;
const DEFAULT_PANEL_DER = 320;

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      /* ── Defaults ── */
      panelIzqAncho: DEFAULT_PANEL_IZQ,
      panelDerAncho: DEFAULT_PANEL_DER,
      panelIzqColapsado: false,
      panelDerColapsado: false,
      pestañaActivaIzq: "docs",
      vistaActivaIzq: "arbol",
      selectedDocId: null,
      highlightTarget: null,
      ultimoDocumentoAbierto: null,
      paginaDoc: {},
      zoomDoc: {},
      scrollDoc: {},
      pestañaPrincipal: "documentos",
      secondaryTab: "docs",
      openDocIds: [],
      openTabs: [],
      activeTabId: null,

      /* ── Actions ── */
      setPanelIzqAncho: (w) => set({ panelIzqAncho: w }),
      setPanelDerAncho: (w) => set({ panelDerAncho: w }),
      togglePanelIzq: () => set((s) => ({ panelIzqColapsado: !s.panelIzqColapsado })),
      togglePanelDer: () => set((s) => ({ panelDerColapsado: !s.panelDerColapsado })),
      setPestañaActivaIzq: (t) => set({ pestañaActivaIzq: t }),
      setVistaActivaIzq: (v) => set({ vistaActivaIzq: v }),
      setSelectedDocId: (id) => set({ selectedDocId: id }),
      setHighlightTarget: (target) => set({ highlightTarget: target }),
      setUltimoDocumentoAbierto: (doc) => set({ ultimoDocumentoAbierto: doc }),
      setPaginaDoc: (docId, page) =>
        set((s) => ({ paginaDoc: { ...s.paginaDoc, [docId]: page } })),
      setZoomDoc: (docId, zoom) =>
        set((s) => ({ zoomDoc: { ...s.zoomDoc, [docId]: zoom } })),
      setScrollDoc: (docId, pos) =>
        set((s) => ({ scrollDoc: { ...s.scrollDoc, [docId]: pos } })),
      setPestañaPrincipal: (t) => set({ pestañaPrincipal: t }),
      setSecondaryTab: (t) => set({ secondaryTab: t }),

      openDoc: (id) =>
        set((s) => {
          if (s.openDocIds.includes(id)) return {};
          return { openDocIds: [...s.openDocIds, id] };
        }),
      closeDoc: (id) =>
        set((s) => ({
          openDocIds: s.openDocIds.filter((did) => did !== id),
        })),

      openTab: (tab) =>
        set((s) => {
          const exists = s.openTabs.find((t) => t.id === tab.id);
          if (exists) return { activeTabId: tab.id };
          return { openTabs: [...s.openTabs, tab], activeTabId: tab.id };
        }),
      closeTab: (id) =>
        set((s) => {
          const idx = s.openTabs.findIndex((t) => t.id === id);
          const next = s.openTabs.filter((t) => t.id !== id);
          let nextActive = s.activeTabId;
          if (s.activeTabId === id) {
            if (next.length === 0) nextActive = null;
            else nextActive = next[Math.min(idx, next.length - 1)].id;
          }
          return { openTabs: next, activeTabId: nextActive };
        }),
      setActiveTabId: (id) => set({ activeTabId: id }),

      /* ── Programmatic save / restore ── */
      hydrate: () => {
        try {
          const raw = localStorage.getItem("kdcm-layout");
          if (raw) {
            const data = JSON.parse(raw);
            // Zustand persist already does this on init, but this allows explicit
            // rehydration on project open without remounting the store.
            set({ ...data.state });
          }
        } catch { /* ignore corrupt data */ }
      },
      flush: () => {
        // Zustand persist middleware handles this automatically via subscribe.
        // This is a no-op kept for API symmetry.
      },
    }),
    {
      name: "kdcm-layout",
      // Only persist these keys (whitelist)
      partialize: (state) => ({
        panelIzqAncho: state.panelIzqAncho,
        panelDerAncho: state.panelDerAncho,
        panelIzqColapsado: state.panelIzqColapsado,
        panelDerColapsado: state.panelDerColapsado,
        pestañaActivaIzq: state.pestañaActivaIzq,
        vistaActivaIzq: state.vistaActivaIzq,
        ultimoDocumentoAbierto: state.ultimoDocumentoAbierto,
        paginaDoc: state.paginaDoc,
        zoomDoc: state.zoomDoc,
        scrollDoc: state.scrollDoc,
        pestañaPrincipal: state.pestañaPrincipal,
        secondaryTab: state.secondaryTab,
        openDocIds: state.openDocIds,
        openTabs: state.openTabs,
        activeTabId: state.activeTabId,
      }),
    },
  ),
);
