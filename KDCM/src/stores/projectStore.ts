import { create } from "zustand";
import { createProject as bridgeCreateProject, saveCategory as bridgeSaveCategory, saveDocument as bridgeSaveDocument, deleteDocument as bridgeDeleteDocument, getCategories as bridgeGetCategories, getDocuments as bridgeGetDocuments, saveMemo as bridgeSaveMemo, getMemos as bridgeGetMemos, deleteMemo as bridgeDeleteMemo } from "../lib/tauriBridge";

/* ── Types ── */

export interface ProjectDocument {
  id: string;
  name: string;
  type: "pdf" | "docx" | "txt" | "rtf" | "audio" | "image" | "video" | "web" | "biblio" | "survey" | "geo" | "kada";
  path: string;
  size: number;           // bytes
  addedAt: string;        // ISO
  pageCount?: number;
  codedSegments?: number;
  metadata_json?: string;
  color_etiqueta?: string;
}

export interface CategoryRelation {
  id: string;
  label: string;
  targetCategoryId: string;
  targetCategoryName: string;
  targetCategoryColor: string;
  type: "causal" | "association" | "contradiction" | "hierarchy" | "similarity" | "custom";
}

export interface Category {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  description?: string;
  count: number;          // # of coded segments
  es_in_vivo?: boolean;
  es_inteligente?: boolean;
  es_nodo_libre?: boolean;
  coding_rule?: string;
  example_citation?: string;
  /** 3.4 — Metrics */
  rooting?: number;       // enraizamiento
  density?: number;       // densidad (connections count)
  documentCount?: number; // docs containing this code
  researcherCount?: number; // researchers using this code
  /** 3.4 — Relations */
  relations?: CategoryRelation[];
}

export interface Memo {
  id: string;
  title: string;
  content: string;
  linkedDocIds: string[];
  linkedCodeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  researcherName: string;
}

interface ProjectState {
  /* ── Project ── */
  project: Project | null;
  isOpen: boolean;

  /* ── Collections ── */
  documents: ProjectDocument[];
  categories: Category[];
  memos: Memo[];

  /* ── Actions ── */
  createProject: (name: string, researcherName: string) => void;
  openProject: (id: string) => void;
  closeProject: () => void;
  addDocument: (doc: ProjectDocument) => void;
  removeDocument: (id: string) => void;
  updateDocument: (id: string, patch: Partial<ProjectDocument>) => void;
  addCategory: (cat: Category) => void;
  removeCategory: (id: string) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  addMemo: (memo: Memo) => void;
  updateMemo: (id: string, patch: Partial<Memo>) => void;
  removeMemo: (id: string) => void;
}

let idCounter = 0;
const uid = () => `${Date.now()}-${++idCounter}-${Math.random().toString(36).slice(2, 8)}`;

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  isOpen: false,
  documents: [],
  categories: [],
  memos: [],

  createProject: async (name, researcherName) => {
    const project: Project = {
      id: uid(),
      name,
      researcherName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set({ project, isOpen: true, documents: [], categories: [], memos: [] });
    // Sync to backend
    bridgeCreateProject(name, "", researcherName).catch(() => {});
  },

  openProject: async (id) => {
    set({ isOpen: true });
    // Hydrate from backend
    try {
      const [cats, docs, memosData] = await Promise.all([bridgeGetCategories(id), bridgeGetDocuments(id), bridgeGetMemos(id)]);
      if (cats.length > 0 || docs.length > 0 || (memosData && memosData.rows && memosData.rows.length > 0)) {
        set({
          categories: cats.map((c: any) => ({ id: c.id, name: c.nombre, color: c.color_hex, parentId: c.codigo_padre_id || null, description: c.descripcion || "", count: 0, es_in_vivo: c.es_in_vivo, es_inteligente: false, es_nodo_libre: c.es_nodo_libre })),
          documents: docs.map((d: any) => ({ id: d.id, name: d.nombre, type: d.tipo as any, path: d.ruta_archivo || "", size: d.tamanio_bytes, addedAt: d.fecha_importacion })),
          memos: memosData && memosData.rows ? memosData.rows.map((m: any) => ({ id: m.id, title: m.titulo, content: m.contenido || "", linkedDocIds: [] as string[], linkedCodeIds: [] as string[], createdAt: m.fecha, updatedAt: m.fecha })) : [],
        });
      }
    } catch { /* backend not available */ }
  },

  closeProject: () => {
    set({ project: null, isOpen: false, documents: [], categories: [], memos: [] });
  },

  addDocument: (doc) => {
    set((s) => ({ documents: [...s.documents, doc] }));
    const st = useProjectStore.getState();
    if (st.project) bridgeSaveDocument(doc.id, st.project.id, doc.name, doc.type, doc.path, doc.size).catch(() => {});
  },

  removeDocument: (id) => {
    set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }));
    bridgeDeleteDocument(id).catch(() => {});
  },

  updateDocument: (id, patch) =>
    set((s) => ({ documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),

  addCategory: (cat) => {
    set((s) => ({ categories: [...s.categories, cat] }));
    const st = useProjectStore.getState();
    if (st.project) bridgeSaveCategory(cat.id, st.project.id, cat.name, cat.color, cat.description || "", cat.parentId).catch(() => {});
  },

  removeCategory: (id) =>
    set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),

  updateCategory: (id, patch) =>
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })),

  addMemo: (memo) => {
    set((s) => ({ memos: [...s.memos, memo] }));
    const st = useProjectStore.getState();
    if (st.project) bridgeSaveMemo(memo.id, st.project.id, memo.title, memo.content, "general").catch(() => {});
  },

  updateMemo: (id, patch) =>
    set((s) => ({
      memos: s.memos.map((m) => (m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m)),
    })),

  removeMemo: (id) => {
    set((s) => ({ memos: s.memos.filter((m) => m.id !== id) }));
    bridgeDeleteMemo(id).catch(() => {});
  },
}));

// ── dataChanged event emitter for real-time chart updates ──
type DataChangedListener = () => void;
const listeners = new Set<DataChangedListener>();
export function onDataChanged(cb: DataChangedListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emitDataChanged() {
  listeners.forEach(cb => cb());
}

// Patch set to emit on every state change
const originalSet = useProjectStore.setState;
useProjectStore.setState = (...args: any[]) => {
  const result = (originalSet as any).apply(useProjectStore, args);
  emitDataChanged();
  return result;
};
