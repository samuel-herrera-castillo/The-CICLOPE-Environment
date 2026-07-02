import { useState } from "react";
import {
  Search, Plus, Download, X, ArrowRight, ArrowLeftRight, Pencil, Trash2, FileText,
} from "lucide-react";
import { useToast } from "../../stores/toastStore";

interface SegmentLink {
  id: string;
  sourceText: string;
  sourceDoc: string;
  label: string;
  targetText: string;
  targetDoc: string;
  researcher: string;
  date: string;
}


export function SegmentLinkManager() {
  const [links, setLinks] = useState<SegmentLink[]>([]);
  const [search, setSearch] = useState("");
  const [selectedLink, setSelectedLink] = useState<SegmentLink | null>(null);
  const { toast } = useToast();

  const filtered = links.filter((l) =>
    !search || l.label.toLowerCase().includes(search.toLowerCase())
    || l.sourceText.toLowerCase().includes(search.toLowerCase())
    || l.targetText.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-full" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Main table */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Segment links</h2>
          <div className="flex items-center gap-1 ml-4">
            <Search size={12} opacity={0.3} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search links..."
              className="bg-transparent text-xs outline-none w-[180px]" style={{ color: "var(--text-primary)" }} />
          </div>
          <div className="flex-1" />
          <button onClick={() => toast.info("New link", "Create new segment link")}
            className="flex items-center gap-1 rounded-md bg-peach-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-peach-700 min-touch">
            <Plus size={12} /> New link
          </button>
          <button onClick={() => toast.info("Export Excel", "Export links to .xlsx file")}
            className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] hover:bg-gray-50 min-touch"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}><Download size={12} /> Excel</button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr style={{ backgroundColor: "var(--bg-secondary)" }}>
                <th className="px-3 py-2 text-left font-medium opacity-40 border-b" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Source</th>
                <th className="px-3 py-2 text-center font-medium opacity-40 border-b w-[80px]" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Label</th>
                <th className="px-3 py-2 text-left font-medium opacity-40 border-b" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Target</th>
                <th className="px-3 py-2 text-left font-medium opacity-40 border-b" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Researcher</th>
                <th className="px-3 py-2 text-left font-medium opacity-40 border-b" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((link) => (
                <tr key={link.id} className="border-b hover:bg-gray-50 cursor-pointer" style={{ borderColor: "var(--border)" }}
                  onClick={() => setSelectedLink(link)}>
                  <td className="px-3 py-2 max-w-[180px] truncate italic" style={{ color: "var(--text-primary)" }}>
                    &ldquo;{link.sourceText}&rdquo;
                    <div className="text-[9px] opacity-30 mt-0.5">{link.sourceDoc}</div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: "#E3F2FD", color: "#1565C0" }}>
                      {link.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-[180px] truncate italic" style={{ color: "var(--text-primary)" }}>
                    &ldquo;{link.targetText}&rdquo;
                    <div className="text-[9px] opacity-30 mt-0.5">{link.targetDoc}</div>
                  </td>
                  <td className="px-3 py-2 opacity-50">{link.researcher}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); toast.info("Go", `Navigate to source: ${link.sourceDoc}`); }} className="rounded p-0.5 hover:bg-gray-100"><ArrowRight size={11} /></button>
                      <button onClick={(e) => { e.stopPropagation(); toast.info("Go", `Navigate to target: ${link.targetDoc}`); }} className="rounded p-0.5 hover:bg-gray-100"><ArrowLeftRight size={11} /></button>
                      <button onClick={(e) => { e.stopPropagation(); const newLabel = prompt("Edit label:", link.label); if (newLabel) toast.success("Updated", `Label changed to "${newLabel}"`); }}
                        className="rounded p-0.5 hover:bg-gray-100"><Pencil size={11} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setLinks((prev) => prev.filter((l) => l.id !== link.id)); toast.success("Deleted", "Link removed"); }}
                        className="rounded p-0.5 hover:bg-red-50 text-red-400"><Trash2 size={11} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right — preview */}
      {selectedLink && (
        <div className="w-[320px] flex-shrink-0 border-l flex flex-col" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Link detail</span>
            <button onClick={() => setSelectedLink(null)} className="rounded p-1 hover:bg-gray-100"><X size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="rounded-md p-3" style={{ backgroundColor: "rgba(241, 215, 255, 0.5)" }}>
              <div className="flex items-center gap-1 mb-1">
                <FileText size={11} opacity={0.4} />
                <span className="text-[10px] opacity-40">{selectedLink.sourceDoc}</span>
              </div>
              <p className="text-xs italic leading-relaxed" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                &ldquo;{selectedLink.sourceText}&rdquo;
              </p>
            </div>
            <div className="text-center">
              <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ backgroundColor: "#E3F2FD", color: "#1565C0" }}>
                {selectedLink.label}
              </span>
            </div>
            <div className="rounded-md p-3" style={{ backgroundColor: "#E3F2FD" }}>
              <div className="flex items-center gap-1 mb-1">
                <FileText size={11} opacity={0.4} />
                <span className="text-[10px] opacity-40">{selectedLink.targetDoc}</span>
              </div>
              <p className="text-xs italic leading-relaxed" style={{ fontFamily: "'Lora', Georgia, serif" }}>
                &ldquo;{selectedLink.targetText}&rdquo;
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SegmentLinkManager;
