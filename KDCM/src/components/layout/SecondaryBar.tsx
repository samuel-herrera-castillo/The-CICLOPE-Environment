import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLayoutStore, type PestañaPrincipal } from "../../stores/layoutStore";

/* ── Sub-tab definitions ── */

interface SubTab {
  id: string;
  label: string;
  tooltip?: string;
  children?: { id: string; label: string }[];
}

const DOCS_SUBTABS: SubTab[] = [
  { id: "docs",      label: "Docs" },
  { id: "codigos",   label: "Codes" },
  { id: "memos",     label: "Memos" },
  { id: "variables", label: "Variables" },
];

const ANALYSIS_SUBTABS: SubTab[] = [
  { id: "lexical",      label: "Lexical",   tooltip: "Lexical search" },
  { id: "query",        label: "Query",     tooltip: "Query builder" },
  { id: "distribution", label: "Distrib",   tooltip: "Distribution table" },
  { id: "cooccurrence", label: "Co-oc",     tooltip: "Co-occurrences" },
  { id: "concordance",  label: "Concord",   tooltip: "Concordance" },
  { id: "autocoding",   label: "Auto",      tooltip: "Auto-coding" },
  { id: "sentiment",    label: "Opinion",   tooltip: "Sentiment mining" },
  { id: "citation",     label: "Reader",    tooltip: "Citation reader" },
  { id: "split",        label: "Split",     tooltip: "Split category" },
  { id: "redundancy",   label: "Redund",    tooltip: "Redundancies" },
  { id: "extractor",    label: "Extract",   tooltip: "Data extractor" },
  { id: "literature",   label: "Lit Rev",   tooltip: "Literature review" },
  { id: "links",        label: "Links",     tooltip: "Segment links" },
];

const VISUAL_SUBTABS: SubTab[] = [
  { id: "distribution", label: "Distribution", children: [
    { id: "bar", label: "Bar" }, { id: "stacked-bar", label: "Stacked bar" },
    { id: "histogram", label: "Histogram" }, { id: "violin", label: "Violin Plot" },
    { id: "density", label: "Density Plot" }, { id: "beeswarm", label: "Bee Swarm" },
    { id: "pearl", label: "Pearl Chart" },
  ]},
  { id: "network", label: "Network", children: [
    { id: "force", label: "Force-directed" }, { id: "sankey", label: "Sankey" },
    { id: "chord", label: "Chord diagram" }, { id: "arc", label: "Arc diagram" },
    { id: "dependency", label: "Dependency Graph" },
  ]},
  { id: "temporal", label: "Temporal", children: [
    { id: "timeline", label: "Timeline" }, { id: "gantt", label: "Gantt" },
    { id: "streamgraph", label: "Streamgraph" }, { id: "calendar", label: "Heatmap calendar" },
  ]},
  { id: "spatial", label: "Spatial", children: [
    { id: "bubble-map", label: "Bubble map" }, { id: "choropleth", label: "Choropleth" },
    { id: "hexbin", label: "Hexbin map" }, { id: "cartogram", label: "Cartogram" },
  ]},
  { id: "text", label: "Text", children: [
    { id: "wordcloud", label: "Word cloud" }, { id: "phrase-tree", label: "Phrase tree" },
    { id: "sunburst", label: "Sunburst" }, { id: "kwic", label: "KWIC" },
    { id: "dendrogram", label: "Dendrogram" }, { id: "partition", label: "Partition" },
  ]},
  { id: "relational", label: "Relational", children: [
    { id: "scatter", label: "Scatter plot" }, { id: "bubble", label: "Bubble chart" },
    { id: "parallel", label: "Parallel coords" }, { id: "marimekko", label: "Marimekko" },
  ]},
  { id: "comparison", label: "Comparison", children: [
    { id: "radar", label: "Radar chart" }, { id: "slope", label: "Slope graph" },
    { id: "bullet", label: "Bullet chart" },
  ]},
];

function getSubtabs(tab: PestañaPrincipal): SubTab[] {
  switch (tab) {
    case "documentos": return DOCS_SUBTABS;
    case "analisis":   return ANALYSIS_SUBTABS;
    case "visualizar": return VISUAL_SUBTABS;
    default:           return [];
  }
}

/**
 * Secondary navigation bar — 40px, below the main Navbar.
 *
 * Docs    → tabs switch left panel view
 * Analysis → chips open tool tabs in center panel
 * Visual  → chips show chart-type dropdown → opens chart tab in center
 * Maps / Team → hidden
 */
export function SecondaryBar() {
  const { t: td } = useTranslation("docs");
  const { t: ta } = useTranslation("analysis");
  const { t: tv } = useTranslation("viz");
  const activeTab = useLayoutStore((s) => s.pestañaPrincipal);
  const secondaryTab = useLayoutStore((s) => s.secondaryTab);
  const setSecondaryTab = useLayoutStore((s) => s.setSecondaryTab);
  const openTab = useLayoutStore((s) => s.openTab);

  const [dropdownFor, setDropdownFor] = useState<string | null>(null);

  const subtabs = getSubtabs(activeTab);

  // Label mapping for translation
  const getLabel = (sub: SubTab): string => {
    if (activeTab === "documentos") {
      const keys: Record<string, string> = {
        docs: "docs_tab", codigos: "codes_tab", memos: "memos_tab", variables: "variables_tab",
      };
      return td(`document_types.${sub.id}`, td(keys[sub.id] || sub.label));
    }
    if (activeTab === "analisis") {
      return ta(`tools.${sub.id}.name`, sub.label);
    }
    if (activeTab === "visualizar") {
      return tv(`chart_groups.${sub.id}`, sub.label);
    }
    return sub.label;
  };
  if (subtabs.length === 0) return null;

  const handleClick = (sub: SubTab) => {
    setSecondaryTab(sub.id);

    if (activeTab === "analisis") {
      // Open tool as a tab in center panel
      openTab({
        id: `analysis-${sub.id}`,
        section: "analysis",
        toolId: sub.id,
        label: sub.tooltip ?? sub.label,
      });
    } else if (activeTab === "visualizar") {
      // Show dropdown for chart subtypes
      if (sub.children && sub.children.length > 0) {
        setDropdownFor(dropdownFor === sub.id ? null : sub.id);
      }
    }
  };

  const handleChartPick = (group: SubTab, child: { id: string; label: string }) => {
    setDropdownFor(null);
    const tabId = `visual-${child.id}`;
    openTab({
      id: tabId,
      section: "visual",
      toolId: group.id,
      label: child.label,
      chartSubtype: child.id,
    });
  };

  return (
    <nav
      className="flex h-[40px] w-full flex-shrink-0 items-center justify-center gap-0.5 border-b px-2 no-print overflow-visible"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}
      role="tablist"
      aria-label="Secondary navigation"
    >
      {subtabs.map((sub, i) => {
        const isActive = secondaryTab === sub.id;
        const isAnalysis = activeTab === "analisis";
        return (
          <div key={sub.id} className="relative flex-shrink-0 flex items-center">
            {i > 0 && <div className={isAnalysis ? "mx-0.5 h-3 w-px" : "mx-1 h-4 w-px"} style={{ backgroundColor: "var(--border)" }} />}
            <button
              role="tab"
              aria-selected={isActive}
              onClick={() => handleClick(sub)}
              title={sub.tooltip ?? sub.label}
              className={`inline-flex items-center rounded-md font-medium whitespace-nowrap transition-all ${
                isAnalysis
                  ? "px-1.5 py-1 text-[11px]"
                  : "px-2.5 py-1.5 text-[13px] min-touch"
              } ${isActive ? "" : "opacity-50 hover:opacity-80"}`}
              style={{
                backgroundColor: isActive ? "var(--bg-primary)" : "transparent",
                color: "#000",
                borderBottom: isActive ? "2px solid var(--peach)" : "2px solid transparent",
              }}
            >
              {getLabel(sub)}
            </button>

            {/* Visual chart type dropdown */}
            {activeTab === "visualizar" && sub.children && dropdownFor === sub.id && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setDropdownFor(null)} />
                <div className="absolute left-1/2 -translate-x-1/2 top-full z-50 mt-0.5 min-w-[150px] rounded-md border bg-white py-1 shadow-lg"
                  style={{ borderColor: "var(--border)" }}>
                  {sub.children.map((child) => (
                    <button key={child.id}
                      onClick={() => handleChartPick(sub, child)}
                      className="flex w-full items-center px-3 py-1.5 text-[13px] hover:bg-gray-100 whitespace-nowrap min-touch"
                      style={{ color: "#000" }}>
                      {child.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default SecondaryBar;
