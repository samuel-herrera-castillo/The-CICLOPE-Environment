import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, RotateCcw, Save } from "lucide-react";
import { useLayoutStore } from "../stores/layoutStore";
import { useProjectStore, onDataChanged } from "../stores/projectStore";
import { useToast } from "../stores/toastStore";

/* ── All 27 chart components ── */
import { HistogramChart, BoxPlotChart, ViolinPlotChart, DensityPlotChart, BeeSwarmChart, PearlChart } from "../components/viz/charts/DistributionCharts";
import { StepChart, CalendarChart, HorizonChart, AlluvialChart } from "../components/viz/charts/EvolutionCharts";
import { ScatterplotMatrix, HexbinChart, ChordChart } from "../components/viz/charts/CorrelationCharts";
import { CirclePackingChart, PartitionChart, TreemapChart, RoseChart, ForceGraph, DependencyGraph, DendrogramChart } from "../components/viz/charts/HierarchyNetworkCharts";
import { ParallelCoordinatesChart, RadarChart, MarimekkoChart, WordCloudChart, WordTreeChart, KWICChart, DotMapChart } from "../components/viz/charts/MultiTextGeoCharts";
import { ChartWrapper } from "../components/viz/ChartWrapper";

/* ── Chart subtype → component mapping ── */
const CHART_MAP: Record<string, React.ComponentType<any>> = {
  bar: HistogramChart, "stacked-bar": StepChart, histogram: HistogramChart, treemap: TreemapChart, pie: RoseChart,
  force: ForceGraph, sankey: AlluvialChart, chord: ChordChart, arc: ForceGraph,
  timeline: StepChart, gantt: StepChart, streamgraph: HorizonChart, calendar: CalendarChart,
  "bubble-map": DotMapChart, choropleth: DotMapChart, hexbin: HexbinChart, cartogram: DotMapChart,
  wordcloud: WordCloudChart, "phrase-tree": WordTreeChart, sunburst: CirclePackingChart,
  scatter: ScatterplotMatrix, bubble: HexbinChart, parallel: ParallelCoordinatesChart,
  radar: RadarChart, slope: StepChart, bullet: BoxPlotChart,
  violin: ViolinPlotChart, density: DensityPlotChart, beeswarm: BeeSwarmChart, pearl: PearlChart,
  partition: PartitionChart, dependency: DependencyGraph, dendrogram: DendrogramChart,
  marimekko: MarimekkoChart, kwic: KWICChart,
};

const CHART_DISPLAY_NAME: Record<string, string> = {
  bar: "Bar Chart", "stacked-bar": "Stacked Bar", histogram: "Histogram", treemap: "Treemap", pie: "Pie / Donut",
  force: "Force-Directed Graph", sankey: "Sankey Diagram", chord: "Chord Diagram", arc: "Arc Diagram",
  timeline: "Timeline", gantt: "Gantt Chart", streamgraph: "Streamgraph", calendar: "Heatmap Calendar",
  "bubble-map": "Bubble Map", choropleth: "Choropleth", hexbin: "Hexbin Map", cartogram: "Cartogram",
  wordcloud: "Word Cloud", "phrase-tree": "Phrase Tree", sunburst: "Sunburst",
  scatter: "Scatter Plot", bubble: "Bubble Chart", parallel: "Parallel Coordinates",
  radar: "Radar Chart", slope: "Slope Graph", bullet: "Bullet Chart",
  violin: "Violin Plot", density: "Density Plot", beeswarm: "Bee Swarm", pearl: "Pearl Chart",
  partition: "Partition Chart", dependency: "Dependency Graph", dendrogram: "Dendrogram",
  marimekko: "Marimekko Chart", kwic: "KWIC Concordance",
};

/* ── Left panel ── */
export function VisualizeTabLeft() {
  const { t } = useTranslation(["viz", "common"]);
  const openTabs = useLayoutStore((s) => s.openTabs);
  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const chartType = activeTab?.chartSubtype ?? "";
  const categories = useProjectStore((s) => s.categories);

  const isDistribution = ["bar","stacked-bar","histogram","violin","density","beeswarm","pearl"].includes(chartType);
  const isNetwork = ["force","sankey","chord","arc","dependency"].includes(chartType);
  const isTemporal = ["timeline","gantt","streamgraph","calendar"].includes(chartType);
  const isText = ["wordcloud","phrase-tree","sunburst","kwic","dendrogram","partition"].includes(chartType);

  return (
    <div className="flex h-full flex-col" style={{backgroundColor:"var(--bg-panel)"}}>
      <div className="border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{t("common:settings")}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        {!activeTab ? (
          <p className="text-[10px] opacity-20 text-center pt-6">{t("select_chart_to_configure")}</p>
        ) : (
          <>
            <div>
              <label className="text-[10px] font-medium opacity-40 uppercase">{t("common:name")}</label>
              <p className="text-[10px] mt-0.5" style={{color:"var(--text-primary)"}}>
                {t("n_categories", {count: categories.length})} · {t("n_segments", {count: categories.reduce((s: number, c) => s + c.count, 0)})}
              </p>
              {categories.length === 0 && <p className="text-[9px] opacity-20 mt-0.5">{t("empty:no_visualization.subtitle")}</p>}
            </div>
            {isDistribution && (
              <div className="space-y-2">
                <div><label className="text-[9px] opacity-40">{t("params.bins")}</label><select className="w-full rounded border px-1.5 py-1 text-[10px] outline-none mt-0.5" style={{borderColor:"var(--border)",color:"var(--text-primary)"}}><option>10</option><option>20</option><option>50</option></select></div>
                <div><label className="text-[9px] opacity-40">{t("params.weight_range")}</label><div className="flex gap-1 mt-0.5"><input type="number" defaultValue={0} min={0} max={100} className="w-14 rounded border px-1 py-0.5 text-[10px] outline-none" style={{borderColor:"var(--border)",color:"var(--text-primary)"}}/><span className="text-[9px] opacity-20">{t("common:to")}</span><input type="number" defaultValue={100} min={0} max={100} className="w-14 rounded border px-1 py-0.5 text-[10px] outline-none" style={{borderColor:"var(--border)",color:"var(--text-primary)"}}/></div></div>
                <label className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{color:"var(--text-secondary)"}}><input type="checkbox" defaultChecked className="size-3"/>☑ {t("params.show_mean")}</label>
                <label className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{color:"var(--text-secondary)"}}><input type="checkbox" className="size-3"/>☐ {t("params.show_median")}</label>
              </div>
            )}
            {isNetwork && (
              <div className="space-y-2">
                <div><label className="text-[9px] opacity-40">{t("params.top_n")}</label><select className="w-full rounded border px-1.5 py-1 text-[10px] outline-none mt-0.5" style={{borderColor:"var(--border)",color:"var(--text-primary)"}}><option>10</option><option>20</option><option>50</option><option>{t("common:all")}</option></select></div>
                <label className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{color:"var(--text-secondary)"}}><input type="checkbox" defaultChecked className="size-3"/>☑ {t("params.labels")}</label>
                <label className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{color:"var(--text-secondary)"}}><input type="checkbox" className="size-3"/>☐ {t("common:detect", "Detect communities")}</label>
              </div>
            )}
            {isTemporal && (
              <div className="space-y-2">
                <div><label className="text-[9px] opacity-40">{t("common:date")}</label><select className="w-full rounded border px-1.5 py-1 text-[10px] outline-none mt-0.5" style={{borderColor:"var(--border)",color:"var(--text-primary)"}}><option>2026</option><option>2025</option></select></div>
                <div><label className="text-[9px] opacity-40">{t("params.document")} {t("common:sort").toLowerCase()}</label><select className="w-full rounded border px-1.5 py-1 text-[10px] outline-none mt-0.5" style={{borderColor:"var(--border)",color:"var(--text-primary)"}}><option>{t("common:date")}</option><option>{t("common:name")}</option><option>Manual</option></select></div>
              </div>
            )}
            {isText && (
              <div className="space-y-2">
                <div><label className="text-[9px] opacity-40">{t("params.threshold")}</label><input type="number" defaultValue={100} min={50} max={500} className="w-full rounded border px-1.5 py-1 text-[10px] outline-none mt-0.5" style={{borderColor:"var(--border)",color:"var(--text-primary)"}}/></div>
                <div><label className="text-[9px] opacity-40">{t("common:length", "Min chars")}</label><input type="number" defaultValue={3} min={2} max={8} className="w-full rounded border px-1.5 py-1 text-[10px] outline-none mt-0.5" style={{borderColor:"var(--border)",color:"var(--text-primary)"}}/></div>
                <label className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{color:"var(--text-secondary)"}}><input type="checkbox" className="size-3"/>☐ {t("common:normalize", "Normalize (stemming)")}</label>
                <label className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{color:"var(--text-secondary)"}}><input type="checkbox" className="size-3"/>☐ {t("common:compound", "Compound words")}</label>
              </div>
            )}
            <div className="pt-2 border-t" style={{borderColor:"var(--border)"}}>
              <p className="text-[9px] opacity-20 text-center">
                {t("params.threshold")} {CHART_DISPLAY_NAME[chartType] || "chart"}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Center panel ── */
export function VisualizeTabCenter() {
  const { t } = useTranslation(["viz", "common"]);
  const openTabs = useLayoutStore((s) => s.openTabs);
  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const closeTab = useLayoutStore((s) => s.closeTab);
  const setActiveTabId = useLayoutStore((s) => s.setActiveTabId);
  const categories = useProjectStore((s) => s.categories);
  const documents = useProjectStore((s) => s.documents);
  const { toast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => onDataChanged(() => setRefreshKey(k => k + 1)), []);

  const visualTabs = openTabs.filter((t) => t.section === "visual");
  const activeTab = visualTabs.find((t) => t.id === activeTabId) ?? visualTabs[0] ?? null;

  if (visualTabs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm opacity-20">{t("select_chart")}</p>
      </div>
    );
  }

  const ChartComp = activeTab ? (CHART_MAP[activeTab.chartSubtype ?? ""] ?? null) : null;
  const chartName = activeTab ? (CHART_DISPLAY_NAME[activeTab.chartSubtype ?? ""] ?? activeTab.label) : "";

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-0.5 border-b px-1 py-0 overflow-x-auto"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        {visualTabs.map((tab) => {
          const isActive = tab.id === (activeTab?.id ?? null);
          return (
            <div key={tab.id} onClick={() => setActiveTabId(tab.id)}
              className={`group flex items-center gap-1 rounded-t-md px-2.5 py-1.5 text-[11px] font-medium cursor-pointer whitespace-nowrap transition-colors min-touch ${isActive ? "" : "hover:bg-gray-100 opacity-50 hover:opacity-80"}`}
              style={{ backgroundColor: isActive ? "var(--bg-primary)" : "transparent", color: "#000", borderBottom: isActive ? "2px solid var(--peach)" : "2px solid transparent" }}>
              <span>{tab.label}</span>
              <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                className="ml-1 rounded p-0.5 opacity-0 group-hover:opacity-60 hover:opacity-100 hover:bg-gray-200 min-touch" aria-label={`Close ${tab.label}`}><X size={10} /></button>
            </div>
          );
        })}
      </div>

      {/* Chart area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chart toolbar */}
        {activeTab && (
          <div className="flex items-center gap-1 border-b px-3 py-1" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
            <span className="text-[10px] font-semibold" style={{ color: "var(--text-primary)" }}>{chartName}</span>
            <div className="flex-1" />
            <button onClick={() => setRefreshKey(k => k + 1)} className="rounded p-1 hover:bg-gray-100 min-touch" title={t("refresh")}><RotateCcw size={13} opacity={0.4} /></button>
            <button onClick={() => toast.success(t("common:success"), t("save_view"))} className="rounded p-1 hover:bg-gray-100 min-touch" title={t("save_view")}><Save size={13} opacity={0.4} /></button>
          </div>
        )}

        {/* SVG Chart content */}
        <div className="flex-1 overflow-auto p-2">
          {ChartComp ? (
            <ChartWrapper categories={categories} chartName={chartName} minCategories={1}>
              <ChartComp categories={categories} documents={documents} onElementClick={(label: string, detail: string) => toast.info(label, detail)} refreshKey={refreshKey} />
            </ChartWrapper>
          ) : (
            <div className="flex h-full items-center justify-center"><p className="text-xs opacity-20">{t("no_data")}</p></div>
          )}
        </div>

        {/* Status bar */}
        {activeTab && (
          <div className="border-t px-3 py-1 text-[9px] flex items-center gap-3" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <span>{t("n_categories", {count: categories.length})}</span>
            <span>{t("n_docs", {count: documents.length})}</span>
            <span>{t("n_segments", {count: categories.reduce((s: number, c) => s + c.count, 0)})}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function VisualizeTabRight() {
  const { t } = useTranslation(["viz", "common"]);
  const categories = useProjectStore((s) => s.categories);
  const documents = useProjectStore((s) => s.documents);
  const totalSegs = categories.reduce((s, c) => s + c.count, 0);
  return (
    <div className="flex h-full flex-col" style={{backgroundColor:"var(--bg-panel)"}}>
      <div className="border-b px-3 py-2" style={{borderColor:"var(--border)"}}><span className="text-xs font-semibold" style={{color:"var(--text-secondary)"}}>{t("title")}</span></div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
        <div className="flex justify-between"><span style={{color:"var(--text-secondary)"}}>{t("n_categories", {count: categories.length})}</span><span className="font-semibold" style={{color:"#000"}}>{categories.length}</span></div>
        <div className="flex justify-between"><span style={{color:"var(--text-secondary)"}}>{t("n_docs", {count: documents.length})}</span><span className="font-semibold" style={{color:"#000"}}>{documents.length}</span></div>
        <div className="flex justify-between"><span style={{color:"var(--text-secondary)"}}>{t("n_segments", {count: totalSegs})}</span><span className="font-semibold" style={{color:"#000"}}>{totalSegs}</span></div>
        {totalSegs === 0 && <p className="text-[10px] opacity-20 pt-2">{t("empty:no_visualization.subtitle")}</p>}
      </div>
    </div>
  );
}
