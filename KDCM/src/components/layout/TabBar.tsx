import { FileText, BarChart3, PieChart, Map, Users, type LucideIcon } from "lucide-react";
import { useLayoutStore, type PestañaPrincipal } from "../../stores/layoutStore";

interface Tab {
  id: PestañaPrincipal;
  label: string;
  icon: LucideIcon;
}

const TABS: Tab[] = [
  { id: "documentos",  label: "Documents",   icon: FileText },
  { id: "analisis",    label: "Analysis",    icon: BarChart3 },
  { id: "visualizar",  label: "Visualize",   icon: PieChart },
  { id: "mapas",       label: "Maps",        icon: Map },
  { id: "equipo",      label: "Team",        icon: Users },
];

/**
 * Main navigation tab bar.
 *
 * Horizontal tabs at the top of the center panel, switching between
 * the app's main sections: Documents, Analysis, Visualize, Maps, Team.
 */
export function TabBar() {
  const active = useLayoutStore((s) => s.pestañaPrincipal);
  const setActive = useLayoutStore((s) => s.setPestañaPrincipal);

  return (
    <nav
      className="flex h-[40px] items-center justify-center gap-0.5 border-b px-2 no-print"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}
      role="tablist"
      aria-label="Main navigation"
    >
      {TABS.map((tab, i) => {
        const isActive = active === tab.id;
        const Icon = tab.icon;
        return (
          <div key={tab.id} className="flex items-center">
            {i > 0 && <div className="mx-1 h-4 w-px" style={{ backgroundColor: "var(--border)" }} />}
            <button
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-t-md px-3 py-2 text-sm font-medium transition-colors min-touch ${
                isActive ? "" : "opacity-50 hover:opacity-80"
              }`}
              style={{
                backgroundColor: isActive ? "var(--bg-primary)" : "transparent",
                color: "#000",
                borderBottom: isActive ? "2px solid var(--peach)" : "2px solid transparent",
              }}
            >
              <Icon size={14} aria-hidden="true" />
              {tab.label}
            </button>
          </div>
        );
      })}
    </nav>
  );
}

export default TabBar;
