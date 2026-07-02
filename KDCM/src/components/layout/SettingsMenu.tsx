import { useState, useRef, useEffect } from "react";
import {
  Settings, FolderTree, BookOpen, AlertTriangle, Layers,
  Lock, Camera, Archive, Keyboard, BookMarked, FileSearch,
  Info, type LucideIcon,
} from "lucide-react";
import { useToast } from "../../stores/toastStore";
import { useProjectStore } from "../../stores/projectStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { execQuery } from "../../lib/tauriBridge";

interface MenuSection {
  label: string;
  items: { label: string; icon: LucideIcon; action: () => void }[];
}

interface Props {
  onOpenExport?: (modal: string) => void;
}

export function SettingsMenu({ onOpenExport }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const project = useProjectStore((s) => s.project);
  const setActiveTab = useLayoutStore((s) => s.setPestañaPrincipal);
  const setSelectedDocId = useLayoutStore((s) => s.setSelectedDocId);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [open]);

  const closeAnd = (fn: () => void) => { fn(); setOpen(false); };

  const handleFolders = () => {
    setActiveTab("documentos");
    setSelectedDocId(null);
    toast.info("Folders", "Navigate to Documents tab to organize files into folders");
  };

  const handleRedundancies = () => {
    setActiveTab("analisis");
    toast.info("Redundancies", "Use the Redundancy Analyzer tool in the Analysis tab");
  };

  const handleCollections = () => {
    setActiveTab("documentos");
    toast.info("Collections", "Use the Collections panel in the Documents tab to group items");
  };

  const handleJournal = async () => {
    if (!project?.id) return;
    try {
      const r = await execQuery("SELECT COUNT(*) as c FROM diario_investigacion WHERE proyecto_id=?1", [project.id]);
      const count = parseInt(r.rows?.[0]?.c || "0");
      if (count > 0) {
        setActiveTab("analisis");
        toast.success("Journal", `${count} entries found. Open Analysis tab to review.`);
      } else {
        toast.info("Journal", "No entries yet. Create memos with type 'journal' to start your research diary.");
      }
    } catch {
      toast.info("Journal", "Research diary entries are stored as memos.");
    }
  };

  const handleAudit = async () => {
    if (!project?.id) return;
    try {
      const r = await execQuery("SELECT COUNT(*) as c FROM historial_cambios WHERE proyecto_id=?1", [project.id]);
      const count = parseInt(r.rows?.[0]?.c || "0");
      if (count > 0) {
        // Export audit as CSV
        const data = await execQuery("SELECT tipo_accion, entidad_tipo, investigador_id, fecha FROM historial_cambios WHERE proyecto_id=?1 ORDER BY fecha DESC LIMIT 500", [project.id]);
        const csv = "Action,Entity,Researcher,Date\n" + data.rows.map((a:any) => `"${a.tipo_accion||""}","${a.entidad_tipo||""}","${a.investigador_id||""}","${a.fecha||""}"`).join("\n");
        const blob = new Blob([csv], {type:"text/csv"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href=url; a.download="audit_log.csv"; a.click();
        URL.revokeObjectURL(url);
        toast.success("Audit exported", `${count} change records → audit_log.csv`);
      } else {
        toast.info("Audit", "No changes recorded yet. Changes are logged automatically as you work.");
      }
    } catch {
      toast.info("Audit", "Change history is recorded automatically in the database.");
    }
  };

  const SECTIONS: MenuSection[] = [
    {
      label: "Project",
      items: [
        { label: "Project config",  icon: Settings,        action: () => closeAnd(() => { window.dispatchEvent(new KeyboardEvent("keydown", { ctrlKey: true, key: ",", bubbles: true })); }) },
        { label: "Protect project", icon: Lock,            action: () => closeAnd(() => onOpenExport?.("protect")) },
        { label: "New snapshot",    icon: Camera,          action: () => closeAnd(() => onOpenExport?.("snapshot")) },
        { label: "View snapshots",  icon: Archive,         action: () => closeAnd(() => onOpenExport?.("snapshot")) },
      ],
    },
    {
      label: "Tools",
      items: [
        { label: "Folders",         icon: FolderTree,      action: () => closeAnd(() => handleFolders()) },
        { label: "Codebook",        icon: BookOpen,        action: () => closeAnd(() => onOpenExport?.("codebook")) },
        { label: "Redundancies",    icon: AlertTriangle,   action: () => closeAnd(() => handleRedundancies()) },
        { label: "Collections",     icon: Layers,          action: () => closeAnd(() => handleCollections()) },
      ],
    },
    {
      label: "Application",
      items: [
        { label: "Preferences",     icon: Settings,        action: () => closeAnd(() => { window.dispatchEvent(new KeyboardEvent("keydown", { ctrlKey: true, key: ",", bubbles: true })); }) },
        { label: "Help & shortcuts",icon: Keyboard,        action: () => closeAnd(() => toast.info("Keyboard Shortcuts", "Ctrl+Shift+F Search · Ctrl+S Snapshot · F11 Fullscreen · Ctrl+, Settings · F1 Help")) },
        { label: "Journal",         icon: BookMarked,      action: () => closeAnd(() => handleJournal()) },
        { label: "Audit",           icon: FileSearch,      action: () => closeAnd(() => handleAudit()) },
      ],
    },
  ];

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded opacity-70 hover:bg-white/10 hover:opacity-100 min-touch"
        aria-label="Settings"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Settings size={15} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-[220px] rounded-lg border py-1 shadow-xl"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg-panel)",
          }}
          role="menu"
        >
          {SECTIONS.map((section, si) => (
            <div key={section.label}>
              {si > 0 && <div className="mx-4 my-1 border-t" style={{ borderColor: "var(--border)" }} />}
              <div
                className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#000" }}
              >
                {section.label}
              </div>
              {section.items.map((it) => {
                const Icon = it.icon;
                return (
                  <button
                    key={it.label}
                    onClick={it.action}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm hover:bg-gray-100 min-touch"
                    style={{ color: "#000" }}
                    role="menuitem"
                  >
                    <Icon size={13} opacity={0.5} />
                    {it.label}
                  </button>
                );
              })}
            </div>
          ))}

          <div className="mx-4 my-1 border-t" style={{ borderColor: "var(--border)" }} />

          <button
            onClick={() => { toast.info("KDCM v0.1.0", "Qualitative Data Analysis · React + Tauri + SQLite + D3.js"); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm hover:bg-gray-100 min-touch"
            style={{ color: "#000" }}
            role="menuitem"
          >
            <Info size={13} opacity={0.5} />
            About KDCM
          </button>
        </div>
      )}
    </div>
  );
}

export default SettingsMenu;
