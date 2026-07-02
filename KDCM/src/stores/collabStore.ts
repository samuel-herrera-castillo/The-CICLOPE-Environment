import { create } from "zustand";
import { saveCollabSession, closeCollabSession as closeSessionDB } from "../lib/tauriBridge";
import { webrtcEngine } from "../lib/webrtcEngine";

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  online: boolean;
  lastSeen?: string;
  cursor?: { docId: string; position: number } | null;
  role?: "admin" | "collaborator" | "readonly";
  muted?: boolean;
  blocked?: boolean;
  latency?: number;
  currentDoc?: string;
}

export interface CollabSession {
  id: string;
  projectId: string;
  code: string;
  participants: Collaborator[];
  startedAt: string;
  quality: "excellent" | "good" | "fair" | "poor";
  latency: number;
}

export interface MensajeSync {
  tipo: "cita_nueva"|"cita_modificada"|"cita_eliminada"|"codigo_nuevo"|"codigo_modificado"|"cursor_movido"|"memo_guardado"|"red_modificada"|"cita_categorizada";
  datos: any;
  investigadorId: string;
  timestamp: number;
  checksum: string;
}

interface ActivityEvent {
  time: string;
  user: string;
  action: string;
}

interface CollabState {
  session: CollabSession | null;
  isHost: boolean;
  miColor: string;
  miNombre: string;
  pendingMessages: MensajeSync[];
  activityLog: ActivityEvent[];

  startSession: (projectId: string) => Promise<string>;
  joinSession: (code: string, name: string, color: string) => Promise<void>;
  endSession: () => void;
  addParticipant: (p: Collaborator) => void;
  removeParticipant: (id: string) => void;
  updateCursor: (userId: string, docId: string, position: number) => void;
  updateParticipant: (id: string, patch: Partial<Collaborator>) => void;
  addActivity: (user: string, action: string) => void;
  sendChange: (tipo: MensajeSync["tipo"], datos: any) => void;
  receiveChange: (mensaje: MensajeSync) => void;
}

let sessionCounter = 0;

function genCode(): string {
  const chars = "ABCDEFGHIJKLMNPQRSTUVWXYZ23456789";
  return "KDCM-" + Array.from({length:8}, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export const useCollabStore = create<CollabState>((set, get) => ({
  session: null,
  isHost: false,
  miColor: "#F1D7FF",
  miNombre: "",
  pendingMessages: [],
  activityLog: [],

  startSession: async (projectId) => {
    const code = genCode();
    const session: CollabSession = {
      id: `session-${++sessionCounter}`,
      projectId,
      code,
      participants: [],
      startedAt: new Date().toISOString(),
      quality: "excellent",
      latency: 0,
    };
    set({ session, isHost: true, pendingMessages: [], activityLog: [] });
    // Initialize WebRTC encryption and signaling
    webrtcEngine.initEncryption(code).catch(() => {});
    webrtcEngine.initSignaling(code);
    try {
      await saveCollabSession(session.id, projectId, "host", code);
    } catch {}
    return code;
  },

  joinSession: async (code, name, color) => {
    set({ miNombre: name, miColor: color });
    // Initialize WebRTC encryption for this session
    webrtcEngine.initEncryption(code).catch(() => {});
    webrtcEngine.initSignaling(code);
    const session: CollabSession = {
      id: `session-remote-${++sessionCounter}`,
      projectId: "remote",
      code,
      participants: [{ id: `me-${Date.now()}`, name, color, online: true, role: "collaborator" }],
      startedAt: new Date().toISOString(),
      quality: "excellent",
      latency: 0,
    };
    set({ session, isHost: false });
  },

  endSession: () => {
    const s = get().session;
    if (s && get().isHost) {
      closeSessionDB(s.id).catch(() => {});
    }
    webrtcEngine.closeAll();
    set({ session: null, isHost: false, pendingMessages: [], activityLog: [] });
  },

  addParticipant: (p) => set((s) => ({
    session: s.session ? { ...s.session, participants: [...s.session.participants, p] } : null,
  })),

  removeParticipant: (id) => set((s) => ({
    session: s.session ? { ...s.session, participants: s.session.participants.filter(p => p.id !== id) } : null,
  })),

  updateCursor: (userId, docId, position) => set((s) => ({
    session: s.session ? {
      ...s.session,
      participants: s.session.participants.map(p => p.id === userId ? { ...p, cursor: { docId, position } } : p),
    } : null,
  })),

  updateParticipant: (id, patch) => set((s) => ({
    session: s.session ? {
      ...s.session,
      participants: s.session.participants.map(p => p.id === id ? { ...p, ...patch } : p),
    } : null,
  })),

  addActivity: (user, action) => set((s) => {
    const entry: ActivityEvent = { time: new Date().toLocaleTimeString(), user, action };
    const log = [...s.activityLog, entry];
    if (log.length > 100) log.shift();
    return { activityLog: log };
  }),

  sendChange: (tipo, _datos) => {
    const s = get();
    s.addActivity(s.miNombre || "You", `${tipo.replace(/_/g," ")}`);
  },

  receiveChange: (mensaje) => {
    const s = get();
    const inv = s.session?.participants.find(p => p.id === mensaje.investigadorId);
    s.addActivity(inv?.name || mensaje.investigadorId, `${mensaje.tipo.replace(/_/g," ")}`);
  },
}));
