import { useState, useEffect } from "react";
import { Download, Shield, Bell, BellOff, Filter, Upload, GitMerge } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useCollabStore } from "../../stores/collabStore";
import { useToast } from "../../stores/toastStore";
import { execQuery, getResearcherContributions, mergeExternalProject } from "../../lib/tauriBridge";

interface TeamMember {
  id: string; nombre: string; email: string; rol: string; color: string;
  segmentos: number; memos: number; online: boolean; muted: boolean;
}

interface ActivityEntry {
  id: string; time: string; user: string; userColor: string; action: string; detail: string;
}

export function TeamManager() {
  const project = useProjectStore((s) => s.project);
  const session = useCollabStore((s) => s.session);
  const activityLog = useCollabStore((s) => s.activityLog);
  const updateParticipant = useCollabStore((s) => s.updateParticipant);
  const { toast } = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [activeTab, setActiveTab] = useState<"members"|"activity"|"merge">("members");
  const [filterUser, setFilterUser] = useState("all");
  const [mergeFile, setMergeFile] = useState<File|null>(null);
  const [mergeResult, setMergeResult] = useState<any>(null);

  // Load real team members from SQLite
  useEffect(() => {
    if (!project?.id) return;
    (async () => {
      try {
        const contribs = await getResearcherContributions(project.id);
        const memberList: TeamMember[] = (contribs as any[]).map((c: any) => ({
          id: c.investigador_id,
          nombre: c.nombre,
          email: "",
          rol: "member",
          color: c.color_presencia_hex || "#9b59b6",
          segmentos: c.segmentos || 0,
          memos: c.memos || 0,
          online: session?.participants.some(p => p.id === c.investigador_id && p.online) || false,
          muted: session?.participants.some(p => p.id === c.investigador_id && p.muted) || false,
        }));
        if (memberList.length > 0) setMembers(memberList);
        else {
          // Fallback: load from investigadores table
          const invs = await execQuery("SELECT id, nombre, email, color_presencia_hex, rol FROM investigadores WHERE activo=1 ORDER BY nombre", []);
          setMembers((invs.rows as any[]).map((inv: any) => ({
            id: inv.id, nombre: inv.nombre, email: inv.email||"",
            rol: inv.rol||"member", color: inv.color_presencia_hex||"#9b59b6",
            segmentos: 0, memos: 0,
            online: session?.participants.some(p => p.id === inv.id && p.online) || false,
            muted: false,
          })));
        }
      } catch {
        setMembers([]);
      }
    })();
  }, [project?.id, session]);

  const totalSegments = members.reduce((a, m) => a + m.segmentos, 0) || 1;

  const handleToggleMute = (m: TeamMember) => {
    const newMuted = !m.muted;
    setMembers(prev => prev.map(mb => mb.id === m.id ? {...mb, muted: newMuted} : mb));
    updateParticipant(m.id, { muted: newMuted });
    toast.info(newMuted ? "🔕 Muted" : "🔔 Unmuted", `${m.nombre} notifications ${newMuted ? "suppressed" : "restored"}`);
  };

  const handleChangeRole = async (m: TeamMember) => {
    const roles = ["admin", "member", "viewer"];
    const currentIdx = roles.indexOf(m.rol);
    const newRole = roles[(currentIdx + 1) % roles.length];
    setMembers(prev => prev.map(mb => mb.id === m.id ? {...mb, rol: newRole} : mb));
    try {
      await execQuery("UPDATE investigadores SET rol=?1 WHERE id=?2", [newRole, m.id]);
      toast.success("Role updated", `${m.nombre} → ${newRole}`);
    } catch {
      toast.error("Error", "Could not update role in database");
    }
  };

  const handleExportActivity = () => {
    const csv = "Time,User,Action,Detail\n" + activityLog.map(a => `"${a.time}","${a.user}","${a.action}",""`).join("\n");
    const blob = new Blob([csv], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="team_activity.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported", "Activity log → CSV");
  };

  const handleMergeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project?.id) return;
    setMergeFile(file);
    try {
      const text = await file.text();
      const result = await mergeExternalProject(project.id, text);
      setMergeResult(result);
      toast.success("Merge analysis", `${(result as any)?.nuevos||0} new, ${(result as any)?.actualizados||0} updated`);
    } catch (err: any) {
      toast.error("Merge failed", err.message);
    }
  };

  // Build activity from collabStore
  const activities: ActivityEntry[] = activityLog.map((a, i) => {
    const member = members.find(m => m.nombre === a.user);
    return {
      id: `act-${i}`,
      time: a.time,
      user: a.user,
      userColor: member?.color || "#9b59b6",
      action: a.action,
      detail: "",
    };
  });

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Team</h2>
        <div className="flex items-center gap-1 ml-4">
          {(["members","activity","merge"] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`rounded px-3 py-1 text-[11px] font-medium capitalize min-touch ${activeTab===t?"text-white":""}`}
              style={{ backgroundColor: activeTab===t?"#9b59b6":"transparent", color: activeTab===t?"#fff":"var(--text-secondary)" }}>
              {t==="members"?"Members":t==="activity"?"Activity":"Merge"}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {members.length === 0 && (
          <span className="text-[10px] opacity-40">No researchers in this project. Import documents and start coding.</span>
        )}
        {members.length > 0 && (
          <span className="text-[10px] opacity-40">{members.length} researcher(s) · {totalSegments} segments total</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Members tab */}
        {activeTab === "members" && (
          <div className="p-4">
            {members.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 opacity-40">
                <Shield size={40} />
                <p className="mt-3 text-sm">No researchers yet</p>
                <p className="text-xs mt-1">Researchers appear when they code segments or create memos</p>
              </div>
            ) : (
              <>
                {/* Contributor bars */}
                <div className="mb-6">
                  <p className="text-[10px] font-medium uppercase opacity-30 mb-3">Contribution overview</p>
                  <div className="space-y-2">
                    {members.map((m) => {
                      const pct = (m.segmentos/totalSegments)*100;
                      return (
                        <div key={m.id} className="flex items-center gap-2">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white flex-shrink-0" style={{ backgroundColor: m.color }}>{m.nombre.charAt(0)}</span>
                          <span className="w-[70px] text-[10px] truncate" style={{ color: "var(--text-primary)" }}>{m.nombre.split(" ")[0]}</span>
                          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: m.color, opacity: 0.6 }}/>
                          </div>
                          <span className="text-[9px] opacity-30 w-8 text-right">{m.segmentos}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Members table */}
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr style={{ backgroundColor: "var(--bg-secondary)" }}>
                        <th className="px-3 py-2 text-left opacity-40">Researcher</th>
                        <th className="px-3 py-2 text-left opacity-40">Role</th>
                        <th className="px-3 py-2 text-center opacity-40">Status</th>
                        <th className="px-3 py-2 text-right opacity-40">Segments</th>
                        <th className="px-3 py-2 text-right opacity-40">Memos</th>
                        <th className="px-3 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => (
                        <tr key={m.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: m.color }}>{m.nombre.charAt(0)}</span>
                              <span className="font-medium" style={{ color: "var(--text-primary)" }}>{m.nombre}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="rounded-full px-2 py-0.5 text-[9px] font-medium"
                              style={{ backgroundColor: m.rol==="admin"?"rgba(241,215,255,0.5)":"#E3F2FD", color: m.rol==="admin"?"#6B2D80":"#1565C0" }}>
                              {m.rol}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: m.online?"#4CAF50":"#9E9E9E" }}/>
                              <span className="text-[10px] opacity-30">{m.online?"Online":"Offline"}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono" style={{ color: "#9b59b6" }}>{m.segmentos}</td>
                          <td className="px-3 py-2 text-right font-mono opacity-40">{m.memos}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-0.5">
                              <button onClick={() => handleToggleMute(m)}
                                title={m.muted?"Unmute":"Mute"} className="rounded p-0.5 hover:bg-gray-100">
                                {m.muted?<BellOff size={11} opacity={0.3}/>:<Bell size={11} opacity={0.3}/>}
                              </button>
                              <button onClick={() => handleChangeRole(m)}
                                title="Change role" className="rounded p-0.5 hover:bg-gray-100"><Shield size={11} opacity={0.3}/></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Activity tab */}
        {activeTab === "activity" && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4 text-[10px]">
              <Filter size={11} opacity={0.3}/>
              <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}
                className="rounded border px-2 py-1 outline-none"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                <option value="all">All researchers</option>
                {members.map((m) => (<option key={m.id} value={m.nombre}>{m.nombre}</option>))}
              </select>
              <div className="flex-1"/>
              <button onClick={handleExportActivity}
                className="flex items-center gap-1 rounded border px-2 py-1 text-[10px] hover:bg-gray-50 min-touch"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                <Download size={10}/> Export CSV
              </button>
            </div>

            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 opacity-40">
                <p className="text-sm">No activity recorded</p>
                <p className="text-xs mt-1">Start a collaborative session to see live activity</p>
              </div>
            ) : (
              <div className="relative pl-6 border-l-2 space-y-2" style={{ borderColor: "var(--border)" }}>
                {activities.filter((a) => filterUser==="all"||a.user===filterUser).map((a) => (
                  <div key={a.id} className="relative pb-2">
                    <span className="absolute -left-[25px] top-0 inline-block h-3 w-3 rounded-full border-2 border-white" style={{ backgroundColor: a.userColor }}/>
                    <div className="rounded-lg border p-2.5" style={{ borderColor: "var(--border)" }}>
                      <div className="flex items-center gap-2 text-[10px] opacity-30 mb-0.5">
                        <span>{a.time}</span>
                        <span className="font-medium" style={{ color: a.userColor }}>{a.user}</span>
                      </div>
                      <p className="text-[11px]" style={{ color: "var(--text-primary)" }}>{a.action}</p>
                      {a.detail && <p className="text-[10px] opacity-40">{a.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Merge tab */}
        {activeTab === "merge" && (
          <div className="p-4 max-w-[500px] space-y-4">
            <div className="rounded-lg border p-4 text-center" style={{ borderColor: "var(--border)" }}>
              <GitMerge size={32} className="mx-auto mb-2 opacity-30"/>
              <p className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Merge Offline Work</p>
              <p className="text-[10px] opacity-50 mb-3">Combine a .kdcm file from another researcher who worked offline</p>
              <label className="inline-flex items-center gap-1.5 mx-auto rounded-md px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 min-touch cursor-pointer" style={{ backgroundColor: "#9b59b6" }}>
                <Upload size={14}/> Select .kdcm file
                <input type="file" accept=".kdcm,.json" onChange={handleMergeFile} className="hidden"/>
              </label>
              {mergeFile && <p className="text-xs opacity-50 mt-2">File: {mergeFile.name}</p>}
            </div>
            {mergeResult && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg p-3" style={{ backgroundColor: "#E8F5E9" }}>
                  <p className="text-lg font-bold text-green-700">{mergeResult.nuevos||0}</p>
                  <p className="text-[10px] text-green-600">✅ Added</p>
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: "#FFF3E0" }}>
                  <p className="text-lg font-bold text-orange-700">{mergeResult.actualizados||0}</p>
                  <p className="text-[10px] text-orange-600">✏ Updated</p>
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: "#FFEBEE" }}>
                  <p className="text-lg font-bold text-red-700">{mergeResult.eliminados||0}</p>
                  <p className="text-[10px] text-red-600">❌ Deleted</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamManager;
