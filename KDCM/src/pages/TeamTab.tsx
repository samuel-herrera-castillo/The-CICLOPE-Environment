import { useState, useEffect } from "react";
import {
  Users, UserPlus, Link, Copy, CheckCircle, QrCode, Download,
  Upload, GitMerge,
} from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { useCollabStore } from "../stores/collabStore";
import { useProjectStore } from "../stores/projectStore";
import { useToast } from "../stores/toastStore";
import { CollabRoom } from "../components/collab/CollabRoom";
import { JoinSession } from "../components/collab/JoinSession";
import { getResearcherContributions, mergeExternalProject, execQuery } from "../lib/tauriBridge";

interface Researcher {
  id: string; nombre: string; email?: string;
  color_presencia_hex?: string; rol: string;
  activo: boolean; fecha_registro: string;
}

interface Contribution {
  investigador_id: string; nombre: string;
  color_presencia_hex?: string; segmentos: number;
  memos: number; categorias: number;
}

export function TeamTabLeft() {
  const session = useCollabStore((s) => s.session);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          {session ? "Participants" : "Team"}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {session ? (
          <div className="space-y-1">
            {session.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm" style={{ color: "var(--text-primary)" }}>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: p.color }}>
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 text-xs">{p.name}</span>
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.online ? "#4CAF50" : "#BDBDBD" }} />
                {p.cursor && <span className="text-[9px] opacity-30">editing</span>}
              </div>
            ))}
          </div>
        ) : (
          <p className="p-4 text-xs opacity-20 text-center">No active session</p>
        )}
      </div>
    </div>
  );
}

export function TeamTabCenter() {
  const session = useCollabStore((s) => s.session);
  const startSession = useCollabStore((s) => s.startSession);
  const endSession = useCollabStore((s) => s.endSession);
  const project = useProjectStore((s) => s.project);
  const { toast } = useToast();
  const [tab, setTab] = useState<"session"|"researchers"|"contributions"|"merge">("session");
  const [showCollab, setShowCollab] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [copied, setCopied] = useState(false);
  const [researchers, setResearchers] = useState<Researcher[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [mergeFile, setMergeFile] = useState<File | null>(null);
  const [mergeResult, setMergeResult] = useState<any>(null);

  // Load researchers and contributions
  useEffect(() => {
    if (project?.id) {
      execQuery("SELECT id, nombre, email, color_presencia_hex, rol, activo, fecha_registro FROM investigadores WHERE activo=1 ORDER BY nombre", [])
        .then(r => setResearchers(r.rows as unknown as Researcher[]))
        .catch(() => {});
      getResearcherContributions(project.id)
        .then(r => setContributions(r as Contribution[]))
        .catch(() => {});
    }
  }, [project?.id]);

  const handleStartSession = async () => {
    if (!project?.id) { toast.warning("No project", "Open a project first"); return; }
    const code = await startSession(project.id);
    toast.success("Session started", `Room code: ${code}`);
    setShowCollab(true);
  };

  const handleCopyCode = () => {
    if (!session?.code) return;
    navigator.clipboard.writeText(session.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleMergeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMergeFile(file);
    try {
      const text = await file.text();
      if (project?.id) {
        const result = await mergeExternalProject(project.id, text);
        setMergeResult(result);
        toast.success("Merge analysis complete", `${(result as any)?.nuevos || 0} new items found`);
      }
    } catch (err: any) {
      toast.error("Merge failed", err.message);
    }
  };

  const maxSegs = Math.max(1, ...contributions.map(c => c.segmentos));

  if (!session && tab === "session") {
    return (
      <div className="flex h-full flex-col">
        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
          {(["session","researchers","contributions","merge"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-medium ${tab===t?"border-b-2":""}`}
              style={{ borderColor: tab===t?"#9b59b6":"transparent", color: tab===t?"var(--text-primary)":"var(--text-secondary)" }}>
              {t==="session"?"Session":t==="researchers"?"Researchers":t==="contributions"?"Contributions":"Merge"}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-full" style={{ backgroundColor: "var(--bg-secondary)" }}>
            <Users size={40} opacity={0.3} />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Collaboration</h2>
            <p className="mt-1 text-sm opacity-50">Work together in real time on the same project</p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <button onClick={handleStartSession}
              className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 min-touch"
              style={{ backgroundColor: "#9b59b6" }}>
              <UserPlus size={16} /> Start collaborative session
            </button>
            <button onClick={() => setShowJoin(true)}
              className="inline-flex items-center gap-2 text-sm font-medium underline opacity-50 hover:opacity-80"
              style={{ color: "var(--text-secondary)" }}>
              <Link size={14} /> Join with code
            </button>
          </div>
        </div>

        <CollabRoom open={showCollab} onClose={() => setShowCollab(false)} />
        <JoinSession open={showJoin} onClose={() => setShowJoin(false)} />
      </div>
    );
  }

  if (session && tab === "session") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-4 px-4 py-3" style={{ backgroundColor: "#E8F5E9", borderBottom: "1px solid #C8E6C9" }}>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium" style={{ color: "#2E7D32" }}>Session active</span>
          </div>
          <code className="rounded bg-white/60 px-2 py-0.5 text-xs font-mono" style={{ color: "#1B5E20" }}>{session.code}</code>
          <button onClick={handleCopyCode} className="rounded p-1 hover:bg-white/80 min-touch" aria-label="Copy">
            {copied ? <CheckCircle size={14} color="#4CAF50" /> : <Copy size={14} style={{ color: "#2E7D32" }} />}
          </button>
          <div className="flex-1" />
          <button onClick={() => setShowCollab(true)}
            className="rounded-md px-3 py-1 text-xs font-medium text-white" style={{ backgroundColor: "#9b59b6" }}>
            <QrCode size={12} className="inline mr-1"/> Manage
          </button>
          <button onClick={endSession}
            className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">End session</button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm opacity-20">Shared workspace — real-time collaboration area</p>
        </div>
        <CollabRoom open={showCollab} onClose={() => setShowCollab(false)} />
      </div>
    );
  }

  // Researchers tab
  if (tab === "researchers") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
          {(["session","researchers","contributions","merge"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-medium ${tab===t?"border-b-2":""}`}
              style={{ borderColor: tab===t?"#9b59b6":"transparent", color: tab===t?"var(--text-primary)":"var(--text-secondary)" }}>
              {t==="session"?"Session":t==="researchers"?"Researchers":t==="contributions"?"Contributions":"Merge"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {researchers.length === 0 ? (
            <EmptyState variant="no-selection" subtitle="No researchers registered" />
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  <th className="text-left py-2 px-2 opacity-40">Avatar</th>
                  <th className="text-left py-2 px-2 opacity-40">Name</th>
                  <th className="text-left py-2 px-2 opacity-40">Email</th>
                  <th className="text-left py-2 px-2 opacity-40">Role</th>
                  <th className="text-left py-2 px-2 opacity-40">Status</th>
                </tr>
              </thead>
              <tbody>
                {researchers.map(r => (
                  <tr key={r.id} className="border-b hover:bg-gray-50" style={{ borderColor: "var(--border)" }}>
                    <td className="py-2 px-2">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: r.color_presencia_hex || "#9b59b6" }}>{r.nombre.charAt(0)}</span>
                    </td>
                    <td className="py-2 px-2 font-medium">{r.nombre}</td>
                    <td className="py-2 px-2 opacity-50">{r.email || "—"}</td>
                    <td className="py-2 px-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.rol==="admin"?"bg-purple-100 text-purple-700":""}`}>{r.rol}</span>
                    </td>
                    <td className="py-2 px-2">{r.activo ? <span className="text-green-600">● Active</span> : <span className="opacity-30">○ Inactive</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // Contributions tab
  if (tab === "contributions") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
          {(["session","researchers","contributions","merge"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-medium ${tab===t?"border-b-2":""}`}
              style={{ borderColor: tab===t?"#9b59b6":"transparent", color: tab===t?"var(--text-primary)":"var(--text-secondary)" }}>
              {t==="session"?"Session":t==="researchers"?"Researchers":t==="contributions"?"Contributions":"Merge"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {contributions.length === 0 ? (
            <EmptyState variant="no-selection" subtitle="No contributions recorded yet" />
          ) : (
            <div>
              {/* Bar chart */}
              <div className="flex items-end gap-3 h-24 mb-6 px-2">
                {contributions.map(c => (
                  <div key={c.investigador_id} className="flex flex-col items-center gap-1 flex-1 max-w-[80px]">
                    <span className="text-[10px] font-bold">{c.segmentos}</span>
                    <div className="w-full rounded-t transition-all" style={{
                      height: `${(c.segmentos/maxSegs)*80}px`,
                      backgroundColor: c.color_presencia_hex || "#9b59b6",
                      opacity: 0.8,
                    }}/>
                    <span className="text-[9px] opacity-50 truncate w-full text-center">{c.nombre}</span>
                  </div>
                ))}
              </div>
              {/* Table */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="text-left py-2 opacity-40">Researcher</th>
                    <th className="text-right py-2 opacity-40">Segments</th>
                    <th className="text-right py-2 opacity-40">Memos</th>
                    <th className="text-right py-2 opacity-40">Categories</th>
                    <th className="text-right py-2 opacity-40">Bar</th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map(c => (
                    <tr key={c.investigador_id} className="border-b" style={{ borderColor: "var(--border)" }}>
                      <td className="py-2 font-medium">{c.nombre}</td>
                      <td className="py-2 text-right">{c.segmentos}</td>
                      <td className="py-2 text-right">{c.memos}</td>
                      <td className="py-2 text-right">{c.categorias}</td>
                      <td className="py-2">
                        <div className="h-3 w-full rounded-full" style={{ backgroundColor: "var(--bg-secondary)" }}>
                          <div className="h-full rounded-full" style={{
                            width: `${(c.segmentos/maxSegs)*100}%`,
                            backgroundColor: c.color_presencia_hex || "#9b59b6",
                          }}/>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={() => {
                const csv = "Researcher,Segments,Memos,Categories\n" + contributions.map(c => `${c.nombre},${c.segmentos},${c.memos},${c.categorias}`).join("\n");
                const blob = new Blob([csv], {type:"text/csv"});
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href=url; a.download="contributions.csv"; a.click();
              }} className="mt-3 flex items-center gap-1 text-[10px] opacity-40 hover:opacity-80">
                <Download size={10}/> Export to Excel
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Merge tab
  if (tab === "merge") {
    return (
      <div className="flex h-full flex-col">
        <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
          {(["session","researchers","contributions","merge"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-medium ${tab===t?"border-b-2":""}`}
              style={{ borderColor: tab===t?"#9b59b6":"transparent", color: tab===t?"var(--text-primary)":"var(--text-secondary)" }}>
              {t==="session"?"Session":t==="researchers"?"Researchers":t==="contributions"?"Contributions":"Merge"}
            </button>
          ))}
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: "var(--bg-secondary)" }}>
            <GitMerge size={32} opacity={0.3} />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-bold">Merge Offline Work</h3>
            <p className="text-xs opacity-40 mt-1">Combine work from a researcher who worked offline</p>
          </div>
          <label className="flex items-center gap-2 rounded-md border px-4 py-2.5 text-xs font-medium cursor-pointer hover:bg-gray-50"
            style={{ borderColor: "var(--border)" }}>
            <Upload size={14} /> Select .kdcm file
            <input type="file" accept=".kdcm,.json" onChange={handleMergeFile} className="hidden" />
          </label>
          {mergeFile && <p className="text-xs opacity-50">File: {mergeFile.name}</p>}
          {mergeResult && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg p-3" style={{ backgroundColor: "#E8F5E9" }}>
                <p className="text-lg font-bold text-green-700">{mergeResult.nuevos || 0}</p>
                <p className="text-[10px] text-green-600">New</p>
              </div>
              <div className="rounded-lg p-3" style={{ backgroundColor: "#FFF3E0" }}>
                <p className="text-lg font-bold text-orange-700">{mergeResult.actualizados || 0}</p>
                <p className="text-[10px] text-orange-600">Updated</p>
              </div>
              <div className="rounded-lg p-3" style={{ backgroundColor: "#FFEBEE" }}>
                <p className="text-lg font-bold text-red-700">{mergeResult.eliminados || 0}</p>
                <p className="text-[10px] text-red-600">Deleted</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export function TeamTabRight() {
  const session = useCollabStore((s) => s.session);
  const activityLog = useCollabStore((s) => s.activityLog);

  return session ? (
    <div className="flex h-full flex-col">
      <div className="border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Activity log</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-2">
          {activityLog.length === 0 ? (
            <p className="text-xs opacity-30 text-center py-4">No activity yet</p>
          ) : (
            activityLog.slice(-30).reverse().map((ev, i) => (
              <div key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                <span className="opacity-40 font-mono text-[10px]">{ev.time}</span>
                {" "}<span className="font-medium" style={{ color: "var(--text-primary)" }}>{ev.user}</span>
                {" "}{ev.action}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  ) : (
    <EmptyState variant="no-selection" subtitle="Start a session to see activity" />
  );
}
