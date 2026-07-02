import { useState } from "react";
import {
  Search, GitMerge, Pencil, X,
  BarChart3, Eye, MessageSquare, Download,
} from "lucide-react";
import { useToast } from "../../stores/toastStore";

/* ── Types ── */

interface Citation {
  id: string; number: number; text: string; docName: string; page: number;
  categories: string[]; weight: number; comment: string; created: string;
}

type BottomView = "chart" | "preview" | "comment";

function generateCitations(): Citation[] {
  // Real data from SQLite citas table
  return [];
}

export function CitationAdmin() {
  const [citations, setCitations] = useState<Citation[]>(generateCitations());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [bottomView, setBottomView] = useState<BottomView>("preview");
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [commentText, setCommentText] = useState("");
  const { toast } = useToast();

  const filtered = citations.filter((c) =>
    !search || c.text.toLowerCase().includes(search.toLowerCase())
    || c.docName.toLowerCase().includes(search.toLowerCase())
    || c.categories.some((cat) => cat.toLowerCase().includes(search.toLowerCase())));

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const startRename = (cit: Citation) => {
    setEditingId(cit.id); setEditValue(cit.text);
  };

  const commitRename = () => {
    if (!editingId) return;
    setCitations((prev) => prev.map((c) => c.id === editingId ? { ...c, text: editValue } : c));
    setEditingId(null);
  };

  const mergeSelected = () => {
    if (selected.size < 2) { toast.info("Select 2+", "Select at least 2 citations to merge"); return; }
    const ids = Array.from(selected);
    setCitations((prev) => prev.filter((c) => !ids.slice(1).includes(c.id)));
    setSelected(new Set());
    toast.success("Merged", `${ids.length} citations merged`);
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Citation administrator</h2>
        <div className="flex items-center gap-1 ml-4">
          <Search size={12} opacity={0.3} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search citations..."
            className="bg-transparent text-xs outline-none w-[200px]" style={{ color: "var(--text-primary)" }} />
        </div>
        <div className="flex-1" />
        {selected.size >= 2 && (
          <button onClick={mergeSelected}
            className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-green-700 min-touch">
            <GitMerge size={11} /> Merge ({selected.size})
          </button>
        )}
        <button onClick={() => toast.info("Export", "Exporting to Excel...")}
          className="flex items-center gap-1 rounded border px-2 py-1.5 text-[10px] min-touch"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
          <Download size={11} /> Excel
        </button>
      </div>

      {/* Citations table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="sticky top-0 z-10" style={{ backgroundColor: "var(--bg-secondary)" }}>
              <th className="px-3 py-1.5 text-left w-8"><input type="checkbox" style={{ accentColor: "var(--peach)" }} onChange={(e) => {
                if (e.target.checked) setSelected(new Set(filtered.map((c) => c.id)));
                else setSelected(new Set());
              }} /></th>
              <th className="px-3 py-1.5 text-left opacity-40 w-10">#</th>
              <th className="px-3 py-1.5 text-left opacity-40">Citation text</th>
              <th className="px-3 py-1.5 text-left opacity-40 w-[130px]">Document</th>
              <th className="px-3 py-1.5 text-left opacity-40 w-[120px]">Categories</th>
              <th className="px-3 py-1.5 text-right opacity-40 w-14">Weight</th>
              <th className="px-3 py-1.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((cit) => (
              <tr key={cit.id}
                onClick={() => { setSelectedCitation(cit); setBottomView("preview"); }}
                className={`border-t cursor-pointer ${selectedCitation?.id === cit.id ? "" : "hover:bg-gray-50"}`}
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: selectedCitation?.id === cit.id ? "var(--peach)" + "08" : selected.has(cit.id) ? "var(--peach)" + "03" : "transparent",
                }}>
                <td className="px-3 py-1.5"><input type="checkbox" checked={selected.has(cit.id)} onChange={() => toggleSelect(cit.id)}
                  style={{ accentColor: "var(--peach)" }} /></td>
                <td className="px-3 py-1.5 opacity-20">{cit.number}</td>
                <td className="px-3 py-1.5 max-w-[350px]">
                  {editingId === cit.id ? (
                    <input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitRename} onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingId(null); }}
                      className="w-full rounded border px-1.5 py-0.5 text-[11px] outline-none"
                      style={{ borderColor: "var(--peach)", color: "var(--text-primary)" }} />
                  ) : (
                    <span className="truncate block italic" style={{ color: "var(--text-primary)" }}>
                      &ldquo;{cit.text.slice(0, 60)}...&rdquo;
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 opacity-40">P.{cit.page}</td>
                <td className="px-3 py-1.5">
                  {cit.categories.map((cat) => (
                    <span key={cat} className="inline-block rounded-full bg-peach-100 px-1.5 py-0 text-[9px] text-peach-700 mr-1 mb-0.5">{cat}</span>
                  ))}
                </td>
                <td className="px-3 py-1.5 text-right font-mono opacity-40">{cit.weight}</td>
                <td className="px-3 py-1.5">
                  <button onClick={(e) => { e.stopPropagation(); startRename(cit); }}
                    className="rounded p-0.5 hover:bg-gray-100 opacity-20 hover:opacity-60"><Pencil size={10} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 border-t px-4 py-1.5 text-[10px] opacity-30" style={{ borderColor: "var(--border)" }}>
        <span>{citations.length} citations</span>
        <span>{citations.filter((c) => c.categories.length === 0).length} without category</span>
        <span>{citations.filter((c) => c.weight > 80).length} with weight &gt; 80</span>
      </div>

      {/* Bottom panel */}
      {selectedCitation && (
        <div className="border-t" style={{ borderColor: "var(--border)", height: 180 }}>
          <div className="flex items-center border-b px-4 py-1" style={{ borderColor: "var(--border)" }}>
            <div className="flex gap-0.5 text-[10px]">
              {[
                { id: "chart" as const, icon: BarChart3, label: "Chart" },
                { id: "preview" as const, icon: Eye, label: "Preview" },
                { id: "comment" as const, icon: MessageSquare, label: "Comment" },
              ].map((v) => (
                <button key={v.id} onClick={() => setBottomView(v.id)}
                  className={`flex items-center gap-1 rounded px-2 py-1 min-touch ${bottomView === v.id ? "" : "opacity-40 hover:opacity-60"}`}
                  style={{ color: bottomView === v.id ? "#000" : "#000" }}>
                  <v.icon size={11} /> {v.label}
                </button>
              ))}
            </div>
            <button onClick={() => setSelectedCitation(null)} className="ml-auto rounded p-0.5 hover:bg-gray-100"><X size={12} /></button>
          </div>
          <div className="p-4 overflow-y-auto" style={{ height: 150 }}>
            {bottomView === "preview" && (
              <div>
                <p className="text-sm italic leading-relaxed" style={{ fontFamily: "'Lora', Georgia, serif", color: "var(--text-primary)" }}>
                  &ldquo;{selectedCitation.text}&rdquo;
                </p>
                <p className="text-[10px] opacity-30 mt-1">{selectedCitation.docName} · P.{selectedCitation.page} · {selectedCitation.created}</p>
              </div>
            )}
            {bottomView === "chart" && (
              <div className="flex items-end gap-2 h-full">
                {selectedCitation.categories.map((cat, i) => (
                  <div key={cat} className="flex flex-col items-center">
                    <div className="w-8 rounded-t" style={{
                      height: 0, // Real data from SQLite
                      backgroundColor: ["#F1D7FF","#2196F3","#4CAF50","#9C27B0","#F1D7FF"][i % 5],
                      opacity: 0.6,
                    }} />
                    <span className="text-[8px] opacity-30 mt-1 w-12 text-center truncate">{cat}</span>
                  </div>
                ))}
              </div>
            )}
            {bottomView === "comment" && (
              <div>
                <div className="flex gap-2">
                  <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..." rows={3}
                    className="flex-1 resize-none rounded border px-3 py-2 text-xs outline-none"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                  <button onClick={() => { setCitations((prev) => prev.map((c) => c.id === selectedCitation.id ? { ...c, comment: commentText } : c)); setCommentText(""); toast.success("Saved", "Comment saved"); }}
                    className="rounded bg-peach-500 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-peach-700 self-end min-touch">
                    Save
                  </button>
                </div>
                {selectedCitation.comment && (
                  <p className="mt-2 text-[10px] opacity-40 italic">{selectedCitation.comment}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CitationAdmin;
