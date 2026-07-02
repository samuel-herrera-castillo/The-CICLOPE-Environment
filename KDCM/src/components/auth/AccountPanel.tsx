import { useState } from "react";
import { Save, User, HardDrive, Building, Monitor, Download, Camera, AlertTriangle, Trash2 } from "lucide-react";
import { useToast } from "../../stores/toastStore";

interface Props { open: boolean; onClose: () => void; }

type Tab = "profile" | "storage" | "institution" | "desktop";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "profile", label: "My profile", icon: User },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "institution", label: "My institution", icon: Building },
  { id: "desktop", label: "Desktop", icon: Monitor },
];

export function AccountPanel({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("profile");
  const [name, setName] = useState("Ana Martínez");
  const [institution, setInstitution] = useState("Universidad Nacional");
  const [email] = useState("ana@university.edu");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const { toast } = useToast();

  if (!open) return null;

  const storageUsed = 42.7; // MB
  const storageMax = 100;   // MB
  const storagePct = Math.round((storageUsed / storageMax) * 100);
  const barColor = storagePct > 95 ? "#F44336" : storagePct > 80 ? "#F1D7FF" : "var(--peach)";
  const institutionUsers = 12;
  const institutionMax = 30;

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-[900px] max-h-[85vh] rounded-xl shadow-2xl flex"
        style={{ backgroundColor: "var(--bg-panel)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Side tabs */}
        <div className="w-[180px] flex-shrink-0 border-r flex flex-col py-2" style={{ borderColor: "var(--border)" }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-left min-touch ${
                tab === t.id ? "" : "opacity-50 hover:opacity-80"
              }`}
              style={{
                color: "#000",
                backgroundColor: tab === t.id ? "var(--peach)" + "10" : "transparent",
                borderLeft: tab === t.id ? "2px solid var(--peach)" : "2px solid transparent",
              }}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={onClose} className="mx-4 mt-2 rounded-lg bg-red-500 px-4 py-2 text-xs font-medium text-white hover:bg-red-700">
            Sign out
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Profile */}
          {tab === "profile" && (
            <div className="max-w-[450px] space-y-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white" style={{ backgroundColor: "#F1D7FF" }}>A</span>
                  <button onClick={() => toast.info("Change avatar", "Upload a new profile picture")}
                    className="absolute bottom-0 right-0 rounded-full bg-white border p-1 shadow-sm hover:bg-gray-50" title="Change avatar"><Camera size={12} /></button>
                </div>
                <div>
                  <h3 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{name}</h3>
                  <p className="text-xs opacity-40">{email}</p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] opacity-40 mb-0.5 uppercase">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="block text-[10px] opacity-40 mb-0.5 uppercase">Email</label>
                <input value={email} disabled
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none opacity-50"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }} />
                <span className="text-[9px] opacity-20">Read-only</span>
              </div>
              <div>
                <label className="block text-[10px] opacity-40 mb-0.5 uppercase">Institution</label>
                <input value={institution} onChange={(e) => setInstitution(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
              </div>

              <div className="border-t pt-4 mt-4" style={{ borderColor: "var(--border)" }}>
                <button onClick={() => toast.success("Saved", "Profile updated")}
                  className="flex items-center gap-1.5 rounded-lg bg-peach-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-peach-700 min-touch">
                  <Save size={14} /> Save changes
                </button>
              </div>

              {/* Danger zone */}
              <div className="border-t pt-4 mt-4" style={{ borderColor: "var(--border)" }}>
                {!showDelete ? (
                  <button onClick={() => setShowDelete(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2 text-xs font-medium text-red-500 hover:bg-red-50 min-touch">
                    <Trash2 size={12} /> Delete account
                  </button>
                ) : (
                  <div className="rounded-lg border border-red-300 p-3 space-y-2" style={{ backgroundColor: "#FFEBEE" }}>
                    <p className="text-xs font-medium text-red-700">Type DELETE to confirm. This is irreversible.</p>
                    <div className="flex gap-2">
                      <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
                        className="flex-1 rounded border border-red-300 px-3 py-1.5 text-xs outline-none"
                        placeholder="DELETE" />
                      <button disabled={deleteConfirm !== "DELETE"}
                        onClick={() => toast.success("Deleted", "Account scheduled for deletion")}
                        className="rounded bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-30">
                        Confirm
                      </button>
                      <button onClick={() => { setShowDelete(false); setDeleteConfirm(""); }}
                        className="rounded border px-3 py-1.5 text-xs" style={{ borderColor: "var(--border)" }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Storage */}
          {tab === "storage" && (
            <div className="max-w-[500px] space-y-5">
              <div>
                <p className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Storage usage</p>
                <div className="h-6 rounded-full bg-gray-200 overflow-hidden mb-2 relative">
                  <div className="h-full rounded-full flex items-center justify-end px-2 text-[10px] font-bold text-white transition-all"
                    style={{ width: `${storagePct}%`, backgroundColor: barColor, animation: storagePct >= 95 ? "pulse 1.5s infinite" : undefined }}>
                    {storagePct > 15 && `${storagePct}%`}
                  </div>
                </div>
                <p className="text-xs opacity-30">{storageUsed.toFixed(1)} MB used of {storageMax} MB ({storagePct}%)</p>
              </div>

              {/* Warnings */}
              {storagePct >= 80 && (
                <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: storagePct >= 95 ? "#FFEBEE" : "#FFF8E1" }}>
                  <AlertTriangle size={14} style={{ color: storagePct >= 95 ? "#C62828" : "#C4A0D4" }} />
                  <div className="text-[10px]">
                    <p className="font-medium" style={{ color: storagePct >= 95 ? "#C62828" : "#C4A0D4" }}>
                      {storagePct >= 95 ? "⚠ Storage almost full" : "⚠ Approaching storage limit"}
                    </p>
                    <p className="opacity-60 mt-0.5">
                      {storagePct >= 95 ? "Uploads are now blocked until you free up space." : "Consider managing your projects or downloading the desktop app."}
                    </p>
                  </div>
                </div>
              )}

              {/* Project breakdown */}
              <div className="rounded-lg border p-4 space-y-2" style={{ borderColor: "var(--border)" }}>
                <p className="text-[10px] font-medium opacity-40 uppercase">Breakdown by project</p>
                {[
                  { name: "Project KDCM Demo", size: 15.2, pct: 36 },
                  { name: "Research Thesis 2025", size: 12.8, pct: 30 },
                  { name: "Field Study Cúcuta", size: 8.5, pct: 20 },
                  { name: "Literature Review", size: 6.2, pct: 14 },
                ].map((proj) => (
                  <div key={proj.name} className="flex items-center gap-3 text-[11px]">
                    <span className="w-[160px] truncate" style={{ color: "var(--text-primary)" }}>{proj.name}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${proj.pct}%`, backgroundColor: "var(--peach)", opacity: 0.5 }} />
                    </div>
                    <span className="w-12 text-right font-mono opacity-50">{proj.size.toFixed(1)} MB</span>
                  </div>
                ))}
              </div>

              <button onClick={() => toast.info("Desktop", "Download the desktop app for unlimited storage")}
                className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium min-touch"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                <Download size={14} /> Download desktop app for unlimited storage
              </button>
            </div>
          )}

          {/* Institution */}
          {tab === "institution" && (
            <div className="max-w-[500px] space-y-4">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{institution}</p>
              <div>
                <p className="text-[10px] opacity-40 mb-2">Active accounts</p>
                <div className="h-5 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full rounded-full flex items-center justify-center text-[9px] font-bold text-white transition-all"
                    style={{ width: `${(institutionUsers / institutionMax) * 100}%`, backgroundColor: institutionUsers >= 28 ? "#F44336" : institutionUsers >= 25 ? "#F1D7FF" : "var(--peach)" }}>
                    {institutionUsers}/{institutionMax}
                  </div>
                </div>
                <p className="text-[10px] opacity-30 mt-1">{institutionUsers} of {institutionMax} accounts used</p>
              </div>
              {institutionUsers >= 28 && (
                <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: "#FFEBEE" }}>
                  <AlertTriangle size={14} color="#C62828" />
                  <p className="text-[10px] text-red-700">Institution account limit nearly reached. Contact your administrator.</p>
                </div>
              )}
            </div>
          )}

          {/* Desktop */}
          {tab === "desktop" && (
            <div className="max-w-[450px] space-y-4">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Desktop version benefits</h3>
              <div className="space-y-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                {["✅ Unlimited local storage","✅ P2P collaboration via Tailscale","✅ Whisper.cpp native (145MB model included)","✅ Offline work without internet","✅ SQLite local database","✅ Windows / Mac / Linux"].map((b) => (
                  <p key={b}>{b}</p>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                {[{ os: "Windows", icon: "🪟" }, { os: "Mac", icon: "🍎" }, { os: "Linux", icon: "🐧" }].map((dl) => (
                  <button key={dl.os} onClick={() => toast.info("Download", `Downloading KDCM for ${dl.os}...`)}
                    className="flex flex-col items-center gap-2 rounded-lg border p-4 min-touch hover:bg-gray-50 flex-1"
                    style={{ borderColor: "var(--border)" }}>
                    <span className="text-2xl">{dl.icon}</span>
                    <span className="text-[10px] font-medium" style={{ color: "var(--text-primary)" }}>{dl.os}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccountPanel;
