import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useLayoutStore, type PestañaPrincipal } from "./stores/layoutStore";
import { useProjectStore } from "./stores/projectStore";
import { useToast } from "./stores/toastStore";
import { TitleBar } from "./components/layout/TitleBar";
import { AppShell } from "./components/layout/AppShell";
import { SystemDiagnosticModal } from "./components/layout/SystemDiagnosticModal";
import { OnboardingModal } from "./components/onboarding/OnboardingModal";
import { ToastContainer } from "./components/ui/Toast";
import { Welcome } from "./pages/Welcome";
import { GlobalSearch } from "./components/search/GlobalSearch";
import { TTSPlayer } from "./components/tools/TTSPlayer";
import { PreferencesPanel } from "./components/layout/PreferencesPanel";

import { DocumentsTabLeft, DocumentsTabCenter, DocumentsTabRight } from "./pages/DocumentsTab";
import { AnalysisTabLeft, AnalysisTabCenter, AnalysisTabRight } from "./pages/AnalysisTab";
import { VisualizeTabLeft, VisualizeTabCenter, VisualizeTabRight } from "./pages/VisualizeTab";
import { MapsTabLeft, MapsTabCenter, MapsTabRight } from "./pages/MapsTab";
import { NetworksTabLeft, NetworksTabCenter, NetworksTabRight } from "./pages/NetworksTab";
import { TeamTabLeft, TeamTabCenter, TeamTabRight } from "./pages/TeamTab";

function ActiveCenterPanel({ tab }: { tab: PestañaPrincipal }) {
  switch (tab) {
    case "documentos":  return <DocumentsTabCenter />;
    case "analisis":    return <AnalysisTabCenter />;
    case "visualizar":  return <VisualizeTabCenter />;
    case "networks":    return <NetworksTabCenter />;
    case "mapas":       return <MapsTabCenter />;
    case "equipo":      return <TeamTabCenter />;
    default:            return <DocumentsTabCenter />;
  }
}

function CombinedRightPanel({ tab }: { tab: PestañaPrincipal }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {tab !== "documentos" && (
        <div className="flex-shrink-0 border-b" style={{ borderColor: "var(--border)" }}>
          {tab === "analisis"    && <AnalysisTabLeft />}
          {tab === "visualizar"  && <VisualizeTabLeft />}
          {tab === "networks"    && <NetworksTabLeft />}
          {tab === "mapas"       && <MapsTabLeft />}
          {tab === "equipo"      && <TeamTabLeft />}
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        {tab === "documentos"  && <DocumentsTabRight />}
        {tab === "analisis"    && <AnalysisTabRight />}
        {tab === "visualizar"  && <VisualizeTabRight />}
        {tab === "networks"    && <NetworksTabRight />}
        {tab === "mapas"       && <MapsTabRight />}
        {tab === "equipo"      && <TeamTabRight />}
      </div>
    </div>
  );
}

function App() {
  const { t } = useTranslation("nav");
  const activeTab = useLayoutStore((s) => s.pestañaPrincipal);
  const projectIsOpen = useProjectStore((s) => s.isOpen);
  const projectId = useProjectStore((s) => s.project?.id);
  const categories = useProjectStore((s) => s.categories);
  const documents = useProjectStore((s) => s.documents);
  const memos = useProjectStore((s) => s.memos);
  const { toast } = useToast();
  const [prefsOpen, setPrefsOpen] = useState(false);

  useKeyboardShortcuts({
    "Ctrl+Shift+F": useCallback(() => { /* GlobalSearch handles its own open state */ }, []),
    "Ctrl+Z":       useCallback(() => { toast.info("Undo", "Ctrl+Z"); }, [toast]),
    "Ctrl+Y":       useCallback(() => { toast.info("Redo", "Ctrl+Y"); }, [toast]),
    "Ctrl+,":       useCallback(() => { setPrefsOpen(true); }, []),
    "Ctrl+S":       useCallback(() => {
      if (projectId) {
        const snapshot = { categories, documents, memos, timestamp: new Date().toISOString() };
        const snapId = `snap-${Date.now()}`;
        import("./lib/tauriBridge").then(({ execQuery }) => {
          execQuery("INSERT INTO instantaneas (id, proyecto_id, nombre, datos_json, fecha) VALUES (?1,?2,?3,?4,?5)",
            [snapId, projectId, `Snapshot ${new Date().toLocaleString()}`, JSON.stringify(snapshot), new Date().toISOString()]
          ).then(() => toast.success(t("snapshots"), snapId.slice(0, 20)))
           .catch(() => toast.warning("Snapshot", "Saved to memory only"));
        });
      }
    }, [projectId, categories, documents, memos, toast, t]),
    "F1":           useCallback(() => { toast.info("KDCM Help", "Ctrl+Shift+F · Ctrl+S · F11 · Ctrl+,"); }, [toast]),
    "Escape":       useCallback(() => {}, []),
    "F11":          useCallback(() => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      else document.exitFullscreen().catch(() => {});
    }, []),
  });

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      <TitleBar />

      {projectIsOpen ? (
        <AppShell
          leftPanel={<DocumentsTabLeft />}
          centerPanel={<ActiveCenterPanel tab={activeTab} />}
          rightPanel={<CombinedRightPanel tab={activeTab} />}
        />
      ) : (
        <main className="flex-1 overflow-auto">
          <Welcome />
        </main>
      )}

      {/* Global search (Ctrl+Shift+F) */}
      {projectId && <GlobalSearch projectId={projectId} onNavigate={(type, id) => {
        toast.info("Navigating", `${type}: ${id.slice(0, 30)}`);
      }} />}

      {/* TTS floating player */}
      <TTSPlayer />

      {/* Settings panel (Ctrl+,) */}
      {prefsOpen && <PreferencesPanel open={prefsOpen} onClose={() => setPrefsOpen(false)} />}

      <OnboardingModal />
      <SystemDiagnosticModal />
      <ToastContainer />
    </div>
  );
}

export default App;
