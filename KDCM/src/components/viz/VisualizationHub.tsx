import { useState } from "react";
import {
  BarChart3, CandlestickChart, ScatterChart, GitMerge,
  Network, Radar, Type, MapPin, Download, Maximize2,
  RefreshCw, Save, ChevronDown, Info, Image, FileSpreadsheet,
} from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
// All 27 D3 charts
import { HistogramChart, BoxPlotChart, ViolinPlotChart, DensityPlotChart, BeeSwarmChart, PearlChart } from "./charts/DistributionCharts";
import { StepChart, CalendarChart, HorizonChart, AlluvialChart } from "./charts/EvolutionCharts";
import { ScatterplotMatrix, HexbinChart, ChordChart } from "./charts/CorrelationCharts";
import { CirclePackingChart, PartitionChart, TreemapChart, RoseChart, ForceGraph, DependencyGraph, DendrogramChart } from "./charts/HierarchyNetworkCharts";
import { ParallelCoordinatesChart, RadarChart, MarimekkoChart, WordCloudChart, WordTreeChart, KWICChart, DotMapChart } from "./charts/MultiTextGeoCharts";

/* ══════════════════════════════════════════════════════
   Chart Registry — 27 charts in 8 groups
   ══════════════════════════════════════════════════════ */

interface ChartDef {
  id: string;
  title: string;
  group: string;
  icon: React.ComponentType<{ size?: number }>;
  description: string;
}

const CHART_GROUPS: { label: string; icon: React.ComponentType<{ size?: number }>; charts: ChartDef[] }[] = [
  {
    label: "Distribution", icon: BarChart3, charts: [
      { id: "histogram", title: "Histogram", group: "Distribution", icon: BarChart3, description: "Bar chart of weight distribution" },
      { id: "boxplot", title: "Box Plot", group: "Distribution", icon: BarChart3, description: "Quartiles and outliers" },
      { id: "violin", title: "Violin Plot", group: "Distribution", icon: BarChart3, description: "KDE density estimation" },
      { id: "density", title: "Density Plot", group: "Distribution", icon: BarChart3, description: "Smoothed density curves" },
      { id: "beeswarm", title: "Bee Swarm", group: "Distribution", icon: BarChart3, description: "Force-directed scatter" },
      { id: "pearl", title: "Pearl Chart", group: "Distribution", icon: BarChart3, description: "Density-proportional circles" },
    ],
  },
  {
    label: "Evolution", icon: CandlestickChart, charts: [
      { id: "step", title: "Step Chart", group: "Evolution", icon: CandlestickChart, description: "Step-after line chart" },
      { id: "calendar", title: "Calendar View", group: "Evolution", icon: CandlestickChart, description: "GitHub-style heatmap" },
      { id: "horizon", title: "Horizon Chart", group: "Evolution", icon: CandlestickChart, description: "Folded time series" },
      { id: "alluvial", title: "Alluvial Diagram", group: "Evolution", icon: CandlestickChart, description: "Flow between strata" },
    ],
  },
  {
    label: "Correlation", icon: ScatterChart, charts: [
      { id: "scatterplot-matrix", title: "Scatterplot Matrix", group: "Correlation", icon: ScatterChart, description: "N×N sub-chart grid" },
      { id: "hexbin", title: "Hexbin Map", group: "Correlation", icon: ScatterChart, description: "Hexagonal binning" },
      { id: "chord", title: "Chord Diagram", group: "Correlation", icon: ScatterChart, description: "Inter-category ribbons" },
    ],
  },
  {
    label: "Hierarchy", icon: GitMerge, charts: [
      { id: "circle-packing", title: "Circle Packing", group: "Hierarchy", icon: GitMerge, description: "Nested bubble chart" },
      { id: "partition", title: "Partition Chart", group: "Hierarchy", icon: GitMerge, description: "Icicle/sunburst layout" },
      { id: "treemap", title: "Treemap", group: "Hierarchy", icon: GitMerge, description: "Squarified area chart" },
      { id: "rose", title: "Rose Chart", group: "Hierarchy", icon: GitMerge, description: "Polar area sectors" },
    ],
  },
  {
    label: "Networks", icon: Network, charts: [
      { id: "force", title: "Relation Map", group: "Networks", icon: Network, description: "Force-directed graph" },
      { id: "dependency", title: "Dependency Graph", group: "Networks", icon: Network, description: "Directed arrows" },
      { id: "dendrogram", title: "Dendrogram", group: "Networks", icon: Network, description: "Hierarchical clustering" },
    ],
  },
  {
    label: "Multidimensional", icon: Radar, charts: [
      { id: "parallel", title: "Parallel Coordinates", group: "Multidimensional", icon: Radar, description: "Multi-axis lines" },
      { id: "radar", title: "Radar Chart", group: "Multidimensional", icon: Radar, description: "Polar polygon overlay" },
      { id: "marimekko", title: "Marimekko", group: "Multidimensional", icon: Radar, description: "Variable-width stacked bars" },
    ],
  },
  {
    label: "Text", icon: Type, charts: [
      { id: "wordcloud", title: "Word Cloud", group: "Text", icon: Type, description: "Frequency-based word layout" },
      { id: "wordtree", title: "Word Tree", group: "Text", icon: Type, description: "Branching context view" },
      { id: "kwic", title: "KWIC", group: "Text", icon: Type, description: "Key word in context table" },
    ],
  },
  {
    label: "Geographic", icon: MapPin, charts: [
      { id: "dotmap", title: "Dot Map", group: "Geographic", icon: MapPin, description: "Mercator point map" },
    ],
  },
];

const ALL_CHARTS: ChartDef[] = CHART_GROUPS.flatMap((g) => g.charts);

export function VisualizationHub() {
  const categories = useProjectStore((s) => s.categories);
  const documents = useProjectStore((s) => s.documents);
  const { toast } = useToast();

  const [selectedChart, setSelectedChart] = useState<ChartDef>(ALL_CHARTS[0]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["Distribution"]));
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedElement, setSelectedElement] = useState<{ label: string; detail: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });
  };

  const totalSegments = categories.reduce((a, c) => a + c.count, 0);

  const cats = categories.map(c => ({ name: c.name, color: c.color, id: c.id }));
  const docs = documents.map(d => ({ name: d.name, id: d.id, count: d.codedSegments ?? 0 }));

  const handleElementClick = (label: string, detail: string) => {
    setSelectedElement({ label, detail });
  };

  const handleExportPNG = () => {
    const svgEl = document.querySelector(".chart-area svg") as SVGSVGElement;
    if (!svgEl) { toast.info("Export", "No chart to export"); return; }
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(clone);
    const canvas = document.createElement("canvas");
    const rect = svgEl.getBoundingClientRect();
    canvas.width = rect.width * 2; canvas.height = rect.height * 2;
    const ctx = canvas.getContext("2d")!;
    const img = new window.Image();
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    img.onload = () => { ctx.drawImage(img, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url);
      canvas.toBlob((b) => { if (b) { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `${selectedChart.id}.png`; a.click(); } }); };
    img.src = url;
    toast.success("Exported", "PNG downloaded");
  };

  const handleExportSVG = () => {
    const svgEl = document.querySelector(".chart-area svg");
    if (!svgEl) { toast.info("Export", "No chart to export"); return; }
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${selectedChart.id}.svg`; a.click();
    toast.success("Exported", "SVG downloaded");
  };

  const chartProps = { categories: cats, documents: docs, onElementClick: handleElementClick, refreshKey };

  const renderChart = () => {
    switch (selectedChart.id) {
      case "histogram": return <HistogramChart {...chartProps} />;
      case "boxplot": return <BoxPlotChart {...chartProps} />;
      case "violin": return <ViolinPlotChart {...chartProps} />;
      case "density": return <DensityPlotChart {...chartProps} />;
      case "beeswarm": return <BeeSwarmChart {...chartProps} />;
      case "pearl": return <PearlChart {...chartProps} />;
      case "step": return <StepChart {...chartProps} />;
      case "calendar": return <CalendarChart {...chartProps} />;
      case "horizon": return <HorizonChart {...chartProps} />;
      case "alluvial": return <AlluvialChart {...chartProps} />;
      case "scatterplot-matrix": return <ScatterplotMatrix {...chartProps} />;
      case "hexbin": return <HexbinChart {...chartProps} />;
      case "chord": return <ChordChart categories={cats} onElementClick={handleElementClick} />;
      case "circle-packing": return <CirclePackingChart {...chartProps} />;
      case "partition": return <PartitionChart {...chartProps} />;
      case "treemap": return <TreemapChart {...chartProps} />;
      case "rose": return <RoseChart {...chartProps} />;
      case "force": return <ForceGraph categories={cats} onElementClick={handleElementClick} refreshKey={refreshKey} />;
      case "dependency": return <DependencyGraph {...chartProps} />;
      case "dendrogram": return <DendrogramChart {...chartProps} />;
      case "parallel": return <ParallelCoordinatesChart {...chartProps} />;
      case "radar": return <RadarChart {...chartProps} />;
      case "marimekko": return <MarimekkoChart {...chartProps} />;
      case "wordcloud": return <WordCloudChart {...chartProps} />;
      case "wordtree": return <WordTreeChart {...chartProps} />;
      case "kwic": return <KWICChart {...chartProps} />;
      case "dotmap": return <DotMapChart {...chartProps} />;
      default: return <HistogramChart {...chartProps} />;
    }
  };

  return (
    <div className="flex h-full" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Left panel — Chart selector + params */}
      <div className="w-[280px] flex-shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <div className="border-b px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Visualizations</h2>
          <p className="text-[10px] opacity-30 mt-0.5">27 charts · 8 groups</p>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          {CHART_GROUPS.map((group) => {
            const GroupIcon = group.icon;
            const isExpanded = expandedGroups.has(group.label);
            return (
              <div key={group.label}>
                <button onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-gray-50 min-touch"
                  style={{ color: "var(--text-primary)" }}>
                  <ChevronDown size={10} style={{ transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 150ms" }} />
                  <span className="opacity-50"><GroupIcon size={14} /></span>
                  {group.label}
                </button>
                {isExpanded && group.charts.map((chart) => (
                  <button key={chart.id} onClick={() => { setSelectedChart(chart); setSelectedElement(null); }}
                    className={`flex w-full items-center gap-2 pl-10 pr-3 py-1.5 text-xs min-touch transition-colors ${
                      selectedChart.id === chart.id ? "" : "hover:bg-gray-50"
                    }`}
                    style={{
                      color: selectedChart.id === chart.id ? "#000" : "#000",
                      backgroundColor: selectedChart.id === chart.id ? "var(--peach)" + "10" : "transparent",
                      borderLeft: selectedChart.id === chart.id ? "2px solid var(--peach)" : "2px solid transparent",
                    }}>
                    {chart.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Center — Chart */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          <span className="text-[10px] opacity-30">{selectedChart.group} →</span>
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{selectedChart.title}</span>
          <div className="flex-1" />
          <button onClick={handleExportPNG} className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Export PNG"><Download size={14} opacity={0.4} /></button>
          <button onClick={handleExportSVG} className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Export SVG"><Image size={14} opacity={0.4} /></button>
          <button onClick={() => toast.info("CSV", "Exporting as CSV...")} className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Export CSV"><FileSpreadsheet size={14} opacity={0.4} /></button>
          <button onClick={() => { setRefreshKey(k => k + 1); setSelectedElement(null); }}
            className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Refresh"><RefreshCw size={14} opacity={0.4} /></button>
          <button onClick={() => { localStorage.setItem("kdcm-saved-view", selectedChart.id); toast.success("Saved", `View "${selectedChart.title}" saved`); }}
            className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Save view"><Save size={14} opacity={0.4} /></button>
          <button onClick={() => setFullscreen((f) => !f)}
            className="rounded p-1.5 hover:bg-gray-100 min-touch" title="Fullscreen"><Maximize2 size={14} opacity={0.4} /></button>
        </div>

        {/* Chart area */}
        <div className={`chart-area flex-1 overflow-auto p-4 ${fullscreen ? "fixed inset-0 z-[350] p-8" : ""}`}
          style={{ backgroundColor: fullscreen ? "var(--bg-primary)" : "transparent" }}>
          {renderChart()}
        </div>

        {/* Footer stats */}
        <div className="flex items-center gap-4 border-t px-4 py-1.5 text-[10px] opacity-30" style={{ borderColor: "var(--border)" }}>
          <span>{categories.length} categories</span>
          <span>{documents.length} docs</span>
          <span>{totalSegments} segments</span>
        </div>
      </div>

      {/* Right panel — Element inspector */}
      <div className="w-[300px] flex-shrink-0 border-l flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <div className="border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-xs font-semibold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
            <Info size={13} /> Inspector
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {selectedElement ? (
            <div className="space-y-2 text-xs">
              <p className="font-medium" style={{ color: "var(--text-primary)" }}>{selectedElement.label}</p>
              <p className="opacity-50">{selectedElement.detail}</p>
            </div>
          ) : (
            <p className="text-xs opacity-20 text-center pt-8">
              Click on a chart element to inspect it
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default VisualizationHub;
