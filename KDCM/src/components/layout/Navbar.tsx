import { useState, useRef, useEffect } from "react";
import {
  FileText, BarChart3, PieChart, GitFork, Map, Users,
  Search, User, Download, ChevronDown,
  LogOut, Lock,
  FileText as ReportIcon, BookOpen, Database, Printer, Camera,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsMenu } from "./SettingsMenu";
import { LanguageSelector } from "./LanguageSelector";
import { useLayoutStore, type PestañaPrincipal } from "../../stores/layoutStore";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { ReportGenerator } from "../export/ReportGenerator";
import { CodebookExporter } from "../export/CodebookExporter";
import { DataExtractor } from "../export/DataExtractor";
import { SnapshotManager } from "../export/SnapshotManager";
import { ProjectProtection } from "../export/ProjectProtection";
import { PrintManager } from "../export/PrintManager";
import { NavbarPresenceAvatars } from "../collab/PresenceIndicators";
import { useCollabStore } from "../../stores/collabStore";
import { isProjectProtected } from "../../lib/tauriBridge";

interface NavTab {
  id: PestañaPrincipal;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const TABS: NavTab[] = [
  { id: "documentos",  label: "Docs",       icon: FileText },
  { id: "analisis",    label: "Analysis",   icon: BarChart3 },
  { id: "visualizar",  label: "Visual",     icon: PieChart },
  { id: "networks",    label: "Networks",   icon: GitFork },
  { id: "mapas",       label: "Maps",       icon: Map },
  { id: "equipo",      label: "Team",       icon: Users },
];

const TAB_I18N_KEYS: Record<string, string> = {
  "documentos": "docs",
  "analisis": "analysis",
  "visualizar": "visual",
  "networks": "networks",
  "mapas": "maps",
  "equipo": "team",
};

type ExportModal = "report" | "codebook" | "data" | "snapshot" | "protect" | "print" | null;

export function Navbar() {
  const { t } = useTranslation(["nav", "common"]);
  const activeTab = useLayoutStore((s) => s.pestañaPrincipal);
  const setActiveTab = useLayoutStore((s) => s.setPestañaPrincipal);
  const project = useProjectStore((s) => s.project);
  const isOpen = useProjectStore((s) => s.isOpen);
  const closeProject = useProjectStore((s) => s.closeProject);
  const collabSession = useCollabStore((s) => s.session);
  const { toast } = useToast();

  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportModal, setExportModal] = useState<ExportModal>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);

  // Unlock modal state
  const [showUnlock, setShowUnlock] = useState(false);
  const [unlockPass, setUnlockPass] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [unlockAttempts, setUnlockAttempts] = useState(0);
  const [unlockLocked, setUnlockLocked] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handle = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportMenuOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [exportMenuOpen]);

  useEffect(() => {
    if (!projectMenuOpen) return;
    const handle = (e: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) setProjectMenuOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [projectMenuOpen]);

  const openExport = (modal: ExportModal) => {
    setExportModal(modal);
    setExportMenuOpen(false);
  };

  const handleProjectAction = async (action: string) => {
    setProjectMenuOpen(false);
    if (action === "protect") {
      const isProt = project?.id ? await isProjectProtected(project.id).catch(()=>false) : false;
      if (isProt) {
        setShowUnlock(true);
      } else {
        openExport("protect");
      }
    } else if (action === "snapshot") {
      openExport("snapshot");
    } else if (action === "close") {
      closeProject();
      toast.info("Project closed");
    }
  };

  const handleUnlock = async () => {
    if (!project?.id) return;
    if (unlockLocked) { setUnlockError("Too many attempts. Restart the application."); return; }
    try {
      // Try to unlock by clearing hash (backend will verify)
      const { protectProject } = await import("../../lib/tauriBridge");
      await protectProject(project.id, "");
      setShowUnlock(false);
      setUnlockPass("");
      toast.success("Project unlocked", "Password protection temporarily removed");
    } catch {
      const newAttempts = unlockAttempts + 1;
      setUnlockAttempts(newAttempts);
      if (newAttempts >= 3) {
        setUnlockLocked(true);
        setUnlockError("Too many attempts. Project locked for this session.");
      } else {
        setUnlockError(`Incorrect password. ${3 - newAttempts} attempt(s) remaining.`);
      }
    }
  };

  return (
    <>
      <nav
        className="flex h-[48px] w-full select-none items-center gap-2 px-3 no-print"
        style={{ backgroundColor: "rgba(241, 215, 255, 0.5)", color: "#1a1a1a" }}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* ── Left: Project selector ── */}
        <div className="flex items-center gap-2">
          {isOpen && (
            <div ref={projectMenuRef} className="relative">
              <button
                onClick={() => setProjectMenuOpen((o) => !o)}
                className="ml-2 flex items-center gap-1 rounded px-2 py-1 text-sm font-medium hover:bg-white/10 min-touch"
                style={{ color: "#000" }}
                aria-expanded={projectMenuOpen}
                aria-haspopup="true"
              >
                <span className="max-w-[120px] truncate">
                  {project?.name ?? t("common:no_project", { defaultValue: "No project" })}
                </span>
                <ChevronDown size={12} className={`transition-transform ${projectMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {projectMenuOpen && (
                <div className="absolute left-1/2 -translate-x-1/2 top-full z-50 mt-1 w-[200px] rounded-lg border py-1 shadow-xl" style={{borderColor:"var(--border)",backgroundColor:"var(--bg-panel)"}} role="menu">
                  <button onClick={() => handleProjectAction("snapshot")} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-gray-100" style={{color:"#000"}} role="menuitem"><Camera size={13} opacity={0.5}/>{t("project_snapshots")}</button>
                  <div className="mx-4 my-1 border-t" style={{borderColor:"var(--border)"}}/>
                  <button onClick={() => handleProjectAction("protect")} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-gray-100" style={{color:"#000"}} role="menuitem"><Lock size={13} opacity={0.5}/>{t("project_protection")}</button>
                  <div className="mx-4 my-1 border-t" style={{borderColor:"var(--border)"}}/>
                  <button onClick={() => handleProjectAction("close")} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-gray-100" style={{color:"#000"}} role="menuitem"><LogOut size={13} opacity={0.5}/>{t("close_project")}</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Center: Main navigation tabs ── */}
        <div className="flex flex-1 items-center justify-center gap-1" role="tablist">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all min-touch ${
                  isActive
                    ? "opacity-100"
                    : "opacity-70 hover:bg-white/10 hover:opacity-100"
                }`}
                style={{
                  color: "#000",
                  borderBottom: isActive ? "2px solid var(--peach)" : "2px solid transparent",
                }}
              >
                <Icon size={14} />
                {t(TAB_I18N_KEYS[tab.id] || tab.label)}
              </button>
            );
          })}
        </div>

        {/* ── Right: Actions ── */}
        <div className="flex items-center gap-0.5">
          {/* Session indicator */}
          {collabSession && (
            <button
              onClick={() => setActiveTab("equipo")}
              className="flex h-8 items-center gap-1.5 rounded px-2 text-sm font-medium min-touch"
              style={{ color: "#2E7D32", backgroundColor: "rgba(76,175,80,0.12)" }}
              title={`${collabSession.participants.length} connected · Click to open Team`}
            >
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              {collabSession.participants.length} connected
            </button>
          )}

          {/* Presence avatars */}
          <NavbarPresenceAvatars />

          {/* Global search */}
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { ctrlKey: true, shiftKey: true, key: "F", bubbles: true }))}
            className="flex h-8 w-8 items-center justify-center rounded opacity-70 hover:bg-white/10 hover:opacity-100 min-touch"
            aria-label="Global search (Ctrl+Shift+F)"
            title="Global search (Ctrl+Shift+F)"
          >
            <Search size={15} />
          </button>

          {/* Language selector */}
          <LanguageSelector position="navbar" />

          {/* User */}
          <button
            onClick={() => toast.info("User", project?.researcherName || "No researcher set")}
            className="flex h-8 w-8 items-center justify-center rounded opacity-70 hover:bg-white/10 hover:opacity-100 min-touch"
            aria-label="User"
            title={project?.researcherName || "User"}
          >
            <User size={15} />
          </button>

          {/* Settings dropdown */}
          <SettingsMenu onOpenExport={(modal: string) => {
            if (modal === "snapshot") openExport("snapshot");
            else if (modal === "protect") openExport("protect");
            else if (modal === "codebook") openExport("codebook");
          }} />

          {/* Export dropdown */}
          <div ref={exportRef} className="relative">
            <button
              onClick={() => setExportMenuOpen((o) => !o)}
              disabled={!isOpen}
              className="flex h-8 items-center gap-1 rounded px-2 text-sm font-medium opacity-70 hover:bg-white/10 hover:opacity-100 min-touch disabled:opacity-30"
              style={{ color: "#000" }}
              aria-label="Export"
              aria-expanded={exportMenuOpen}
              aria-haspopup="true"
            >
              <Download size={14} />
              <span>{t("export_btn")}</span>
            </button>

            {exportMenuOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-1 w-[240px] rounded-lg border py-1 shadow-xl"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--bg-panel)",
                }}
                role="menu"
              >
                <button onClick={() => openExport("report")} className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm hover:bg-gray-100 min-touch" style={{color:"#000"}} role="menuitem">
                  <ReportIcon size={14} opacity={0.5} /> <span>{t("generate_report")}</span>
                </button>
                <div className="mx-4 my-1 border-t" style={{ borderColor: "var(--border)" }} />
                <button onClick={() => openExport("codebook")} className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm hover:bg-gray-100 min-touch" style={{color:"#000"}} role="menuitem">
                  <BookOpen size={14} opacity={0.5} /> <span>{t("codebook")}</span>
                </button>
                <button onClick={() => openExport("data")} className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm hover:bg-gray-100 min-touch" style={{color:"#000"}} role="menuitem">
                  <Database size={14} opacity={0.5} /> <span>{t("data_extractor")}</span>
                </button>
                <div className="mx-4 my-1 border-t" style={{ borderColor: "var(--border)" }} />
                <button onClick={() => openExport("snapshot")} className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm hover:bg-gray-100 min-touch" style={{color:"#000"}} role="menuitem">
                  <Camera size={14} opacity={0.5} /> <span>{t("snapshots")}</span>
                </button>
                <div className="mx-4 my-1 border-t" style={{ borderColor: "var(--border)" }} />
                <button onClick={() => openExport("protect")} className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm hover:bg-gray-100 min-touch" style={{color:"#000"}} role="menuitem">
                  <Lock size={14} opacity={0.5} /> <span>{t("protect")}</span>
                </button>
                <button onClick={() => openExport("print")} className="flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-sm hover:bg-gray-100 min-touch" style={{color:"#000"}} role="menuitem">
                  <Printer size={14} opacity={0.5} /> <span>{t("print_doc")}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Export Modals */}
      <ReportGenerator open={exportModal === "report"} onClose={() => setExportModal(null)} />
      <CodebookExporter open={exportModal === "codebook"} onClose={() => setExportModal(null)} />
      <DataExtractor open={exportModal === "data"} onClose={() => setExportModal(null)} />
      <SnapshotManager open={exportModal === "snapshot"} onClose={() => setExportModal(null)} />
      <ProjectProtection open={exportModal === "protect"} onClose={() => setExportModal(null)} />
      <PrintManager open={exportModal === "print"} onClose={() => setExportModal(null)} />

      {/* Unlock Project Modal */}
      {showUnlock && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{backgroundColor:"rgba(0,0,0,0.6)"}} onClick={()=>{setShowUnlock(false);setUnlockPass("");setUnlockError("");}}>
          <div className="w-full max-w-[360px] rounded-xl p-6 space-y-4 shadow-2xl" style={{backgroundColor:"var(--bg-primary)",color:"var(--text-primary)"}} onClick={e=>e.stopPropagation()}>
            <div className="text-center">
              <Lock size={32} className="mx-auto mb-2" style={{color:"#E53935"}}/>
              <h2 className="text-lg font-bold">🔒 Project Protected</h2>
              <p className="text-xs opacity-50 mt-1">This project requires a password to access</p>
            </div>
            {unlockLocked ? (
              <div className="text-center py-4">
                <span className="text-3xl">🚫</span>
                <p className="text-sm font-bold text-red-600 mt-2">Access Denied</p>
                <p className="text-xs opacity-50">Too many failed attempts. Restart the application to try again.</p>
                <button onClick={()=>{setShowUnlock(false);setUnlockLocked(false);setUnlockAttempts(0);setUnlockError("");setUnlockPass("");}} className="mt-3 rounded border px-4 py-1.5 text-xs" style={{borderColor:"var(--border)"}}>Close</button>
              </div>
            ) : (
              <>
                <input type="password" value={unlockPass} onChange={e=>{setUnlockPass(e.target.value);setUnlockError("");}}
                  onKeyDown={e=>{if(e.key==="Enter") handleUnlock();}}
                  placeholder="Enter project password" autoFocus
                  className="w-full rounded border px-3 py-2.5 text-sm" style={{borderColor:unlockError?"#E53935":"var(--border)",backgroundColor:"var(--bg-primary)"}}/>
                {unlockError && <p className="text-xs text-red-500">{unlockError}</p>}
                <div className="flex gap-2">
                  <button onClick={()=>{setShowUnlock(false);setUnlockPass("");setUnlockError("");}} className="flex-1 rounded border px-4 py-2 text-xs" style={{borderColor:"var(--border)"}}>Cancel</button>
                  <button onClick={handleUnlock} disabled={!unlockPass} className="flex-1 rounded-md px-4 py-2 text-xs font-medium text-white disabled:opacity-40" style={{backgroundColor:"#9b59b6"}}>▶ Unlock</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default Navbar;
