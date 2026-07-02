import { useState } from "react";
import { X, FileText, Globe, FileSpreadsheet, Play, MessageCircle, FileArchive, Search, BookOpen, FileJson, Upload } from "lucide-react";
import { TextMediaImporter } from "./TextMediaImporter";
import { WebCaptureImporter } from "./WebCaptureImporter";
import { SurveyImporter } from "./SurveyImporter";
import { YouTubeImporter } from "./YouTubeImporter";
import { RedditImporter } from "./RedditImporter";
import { SocialExportImporter } from "./SocialExportImporter";
import { WebScraperImporter } from "./WebScraperImporter";
import { BiblioImporter } from "./BiblioImporter";
import { KadaImporter } from "./KadaImporter";

interface Props { open: boolean; onClose: () => void; }

type ImporterId = "text" | "web" | "survey" | "youtube" | "reddit" | "social" | "scraper" | "biblio" | "kada" | null;

interface ImporterDef {
  id: ImporterId; label: string; desc: string; icon: React.ComponentType<{ size?: number }>; section: "files" | "internet" | "specialized";
}

const IMPORTERS: ImporterDef[] = [
  // Local files
  { id: "text", label: "Text / Word / PDF", desc: "Import files from your computer", icon: FileText, section: "files" },
  // From internet
  { id: "web", label: "Web capture", desc: "Text from any public web page", icon: Globe, section: "internet" },
  { id: "youtube", label: "YouTube", desc: "Description, comments, and captions from a video", icon: Play, section: "internet" },
  { id: "reddit", label: "Reddit", desc: "Posts and comments from any public thread", icon: MessageCircle, section: "internet" },
  { id: "scraper", label: "Web crawler", desc: "Multiple pages from the same site", icon: Search, section: "internet" },
  { id: "social", label: "My social media", desc: "Your own Twitter, Facebook, or Instagram history", icon: FileArchive, section: "internet" },
  // Specialized formats
  { id: "survey", label: "Survey (Excel/CSV)", desc: "Import questionnaire responses", icon: FileSpreadsheet, section: "specialized" },
  { id: "biblio", label: "Bibliography (RIS/BibTeX)", desc: "References from Zotero, Mendeley, or EndNote", icon: BookOpen, section: "specialized" },
  { id: "kada", label: "A.R.I.A (.kada)", desc: "A.R.I.A field system files", icon: FileJson, section: "specialized" },
];

export function ImportHub({ open, onClose }: Props) {
  const [activeImporter, setActiveImporter] = useState<ImporterId>(null);

  if (!open) return null;

  if (activeImporter) {
    const handleBack = () => setActiveImporter(null);
    switch (activeImporter) {
      case "text": return <TextMediaImporter open={true} onClose={handleBack} />;
      case "web": return <WebCaptureImporter open={true} onClose={handleBack} />;
      case "survey": return <SurveyImporter open={true} onClose={handleBack} />;
      case "youtube": return <YouTubeImporter open={true} onClose={handleBack} />;
      case "reddit": return <RedditImporter open={true} onClose={handleBack} />;
      case "social": return <SocialExportImporter open={true} onClose={handleBack} />;
      case "scraper": return <WebScraperImporter open={true} onClose={handleBack} />;
      case "biblio": return <BiblioImporter open={true} onClose={handleBack} />;
      case "kada": return <KadaImporter open={true} onClose={handleBack} />;
      default: return null;
    }
  }

  const sections = [
    { key: "files", title: "Local files" },
    { key: "internet", title: "From internet" },
    { key: "specialized", title: "Specialized formats" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[600px] rounded-xl p-6 shadow-xl" style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Upload size={18} style={{ color: "#9b59b6" }} />Import documents
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {sections.map((section) => {
            const items = IMPORTERS.filter(i => i.section === section.key);
            if (items.length === 0) return null;
            return (
              <div key={section.key}>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider opacity-30">{section.title}</div>
                <div className="space-y-1">
                  {items.map((imp) => {
                    const Icon = imp.icon;
                    return (
                      <button
                        key={imp.id}
                        onClick={() => setActiveImporter(imp.id)}
                        className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all hover:border-purple-300 hover:shadow-sm min-touch"
                        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", height: 52 }}
                      >
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "#F1D7FF" }}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{imp.label}</p>
                          <p className="text-[10px] opacity-50 mt-0.5 leading-tight">{imp.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ImportHub;
