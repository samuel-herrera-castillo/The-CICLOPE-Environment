import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useProjectStore } from "../stores/projectStore";
import { useLayoutStore } from "../stores/layoutStore";
import { CodeTree } from "../components/codes/CodeTree";
import { QueryBuilder } from "../components/codes/QueryBuilder";
import { DistributionTable } from "../components/codes/DistributionTable";
import { CooccurrenceConcordance } from "../components/codes/CooccurrenceConcordance";
import { AutoCoding } from "../components/codes/AutoCoding";
import { OpinionMining } from "../components/codes/OpinionMining";
import { CitationReader } from "../components/codes/CitationReader";
import { CategorySplitter } from "../components/codes/CategorySplitter";
import { RedundancyAnalyzer } from "../components/codes/RedundancyAnalyzer";
import { LexicalSearch } from "../components/codes/LexicalSearch";
import { DataExtractor } from "../components/codes/DataExtractorTool";
import { LiteratureReview } from "../components/codes/LiteratureReview";
import { LinkAdmin } from "../components/codes/LinkAdmin";

/* ── Tool labels ── */
const TOOL_LABELS: Record<string, string> = {
  lexical: "Lexical search", query: "Query builder", distribution: "Distribution table",
  cooccurrence: "Co-occurrences", concordance: "Concordance", autocoding: "Auto-coding",
  sentiment: "Sentiment mining", citation: "Citation reader", split: "Split category",
  redundancy: "Redundancies", extractor: "Data extractor", literature: "Literature review",
  links: "Segment links",
};

/* ── Tool content dispatcher ── */
function ToolContent({ toolId, onCloseTool }: { toolId: string; onCloseTool?: () => void }) {
  switch (toolId) {
    case "lexical":      return <LexicalSearch />;
    case "query":        return <QueryBuilder />;
    case "distribution": return <DistributionTable />;
    case "cooccurrence": return <CooccurrenceConcordance />;
    case "concordance":  return <CooccurrenceConcordance />;
    case "autocoding":   return <AutoCoding />;
    case "sentiment":    return <OpinionMining />;
    case "citation":     return <CitationReader />;
    case "split":        return <CategorySplitter open={true} category={{ id: "", name: "Select a category", color: "#F1D7FF", parentId: null, count: 0 }} onClose={() => onCloseTool?.()} />;
    case "redundancy":   return <RedundancyAnalyzer />;
    case "extractor":    return <DataExtractor />;
    case "literature":   return <LiteratureReview />;
    case "links":        return <LinkAdmin open={true} onClose={() => {}} />;
    default: {
      const label = TOOL_LABELS[toolId] ?? toolId;
      return <div className="flex h-full items-center justify-center"><div className="text-center"><p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{label}</p><p className="mt-1 text-xs opacity-30">Tool content coming soon</p></div></div>;
    }
  }
}

/* ── Left panel ── */
export function AnalysisTabLeft() {
  const categories = useProjectStore((s) => s.categories);
  return <CodeTree categories={categories} onSelect={() => {}} onCreate={() => {}} onRename={() => {}} onDelete={() => {}} />;
}

/* ── Center panel ── */
export function AnalysisTabCenter() {
  const { t } = useTranslation("analysis");
  const openTabs = useLayoutStore((s) => s.openTabs);
  const activeTabId = useLayoutStore((s) => s.activeTabId);
  const closeTab = useLayoutStore((s) => s.closeTab);
  const setActiveTabId = useLayoutStore((s) => s.setActiveTabId);

  const analysisTabs = openTabs.filter((t) => t.section === "analysis");
  const activeTab = analysisTabs.find((t) => t.id === activeTabId) ?? analysisTabs[0] ?? null;

  if (analysisTabs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm opacity-20">{t("select_tool")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-0.5 border-b px-1 py-0 overflow-x-auto"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        {analysisTabs.map((tab) => {
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
      <div className="flex-1 overflow-auto">
        {activeTab ? <ToolContent toolId={activeTab.toolId} onCloseTool={activeTab ? () => closeTab(activeTab.id) : undefined} /> : <div className="flex h-full items-center justify-center"><p className="text-sm opacity-20">{t("select_tool")}</p></div>}
      </div>
    </div>
  );
}

export function AnalysisTabRight() {
  const { t } = useTranslation(["analysis", "nav"]);
  const categories = useProjectStore((s) => s.categories);
  const documents = useProjectStore((s) => s.documents);
  const memos = useProjectStore((s) => s.memos);
  const totalSegs = categories.reduce((s, c) => s + c.count, 0);
  return (
    <div className="flex h-full flex-col" style={{backgroundColor:"var(--bg-panel)"}}>
      <div className="border-b px-3 py-2" style={{borderColor:"var(--border)"}}><span className="text-xs font-semibold" style={{color:"var(--text-secondary)"}}>{t("hub_title")}</span></div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
        <div className="flex justify-between"><span style={{color:"var(--text-secondary)"}}>{t("nav:docs")}</span><span className="font-semibold" style={{color:"#000"}}>{categories.length}</span></div>
        <div className="flex justify-between"><span style={{color:"var(--text-secondary)"}}>{t("nav:docs")}</span><span className="font-semibold" style={{color:"#000"}}>{documents.length}</span></div>
        <div className="flex justify-between"><span style={{color:"var(--text-secondary)"}}>{t("nav:n_memos", {count: memos.length})}</span><span className="font-semibold" style={{color:"#000"}}>{memos.length}</span></div>
        <div className="flex justify-between"><span style={{color:"var(--text-secondary)"}}>{t("nav:n_citas", {count: totalSegs})}</span><span className="font-semibold" style={{color:"#000"}}>{totalSegs}</span></div>
        <div className="pt-2 border-t mt-2" style={{borderColor:"var(--border)"}}>
          <p className="text-[10px] opacity-40 mb-1">{t("nav:n_codes", {count: categories.length})}</p>
          {[...categories].sort((a,b)=>b.count-a.count).slice(0,5).map(c=>(<div key={c.id} className="flex items-center gap-2 py-0.5"><span className="h-2 w-2 rounded-full" style={{backgroundColor:c.color}}/>{c.name.slice(0,18)}<span className="ml-auto text-[9px] opacity-30">{c.count}</span></div>))}
          {categories.length===0&&<p className="text-[10px] opacity-20">{t("no_data_for_tool")}</p>}
        </div>
      </div>
    </div>
  );
}
