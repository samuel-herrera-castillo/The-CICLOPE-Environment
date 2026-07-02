import { useState } from "react";
import {
  X, Pencil, Trash2, Copy, ArrowRight, Star, Tag, FileText, MessageSquare, Link, Info,
  Plus, Save, Volume2,
} from "lucide-react";
import { useCodingStore } from "../../stores/codingStore";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { useTTSStore } from "../../stores/ttsStore";

interface SegmentLink {
  id: string; direction: "to" | "from";
  label: string; targetText: string; targetDoc: string;
}

interface SegmentComment {
  id: string; author: string; text: string; date: string; isMine: boolean;
}

export interface SegmentData {
  id: string; text: string; docName: string; page: number; paragraph: number;
  authorName: string; authorColor: string; date: string;
  startPos: number; endPos: number; createdAt: string; updatedAt: string;
}

interface Props {
  open: boolean;
  segment: SegmentData | null;
  onClose: () => void;
  onDelete?: () => void;
  onGoToDoc?: () => void;
}

type Tab = "categories" | "paraphrases" | "comments" | "links" | "info";

const TAB_LIST: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "categories", label: "Categories", icon: Tag },
  { id: "paraphrases", label: "Paraphrases", icon: FileText },
  { id: "comments", label: "Comments", icon: MessageSquare },
  { id: "links", label: "Links", icon: Link },
  { id: "info", label: "Info", icon: Info },
];

export function SegmentInspector({ open, segment, onClose, onDelete, onGoToDoc }: Props) {
  const [tab, setTab] = useState<Tab>("categories");
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();
  const openTTS = useTTSStore((s) => s.open);

  const keyEvidence = useCodingStore((s) => s.keyEvidence);
  const toggleKeyEvidence = useCodingStore((s) => s.toggleKeyEvidence);
  const isKeyEvidence = segment ? keyEvidence.includes(segment.id) : false;

  const categories = useProjectStore((s) => s.categories);
  const [assignedCategories, setAssignedCategories] = useState([
    { id: "c1", name: "Emotion", color: "#F1D7FF", weight: 78 },
    { id: "c2", name: "Narrative", color: "#2196F3", weight: 50 },
  ]);

  const [paraphrase, setParaphrase] = useState("");
  const [paraphraseCat, setParaphraseCat] = useState("");

  // Merge local comments with store-persisted comments for this segment
  const storeComments = useCodingStore((s) => s.segmentComments);
  const storeCommentsForSegment = segment ? (storeComments[segment.id] ?? []) : [];

  const [localComments, setLocalComments] = useState<SegmentComment[]>([
    { id: "m1", author: "Ana", text: "This connects with the theoretical framework discussed in memo #3.", date: "2h ago", isMine: true },
    { id: "m2", author: "Carlos", text: "Consider recoding under 'strategy' instead.", date: "Yesterday", isMine: false },
  ]);
  const [newComment, setNewComment] = useState("");

  // Merge: stored comments first, then local mocks
  const comments: SegmentComment[] = [
    ...storeCommentsForSegment.map((c, i) => ({ id: `store-${i}`, author: c.author, text: c.text, date: c.date, isMine: c.author === "You" })),
    ...localComments,
  ];

  const [links] = useState<SegmentLink[]>([
    { id: "l1", direction: "to", label: "contrasts", targetText: "We followed a strict protocol...", targetDoc: "Interview_02.txt" },
    { id: "l2", direction: "from", label: "supports", targetText: "The results were consistent...", targetDoc: "Survey_responses.xlsx" },
  ]);

  if (!open || !segment) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(segment.text).then(
      () => toast.success("Copied", "Segment text copied"),
    );
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    setLocalComments((prev) => [
      { id: `m${Date.now()}`, author: "You", text: newComment.trim(), date: "Just now", isMine: true },
      ...prev,
    ]);
    setNewComment("");
  };

  const updateWeight = (catId: string, weight: number) => {
    setAssignedCategories((prev) => prev.map((c) => (c.id === catId ? { ...c, weight } : c)));
  };

  const removeCategory = (catId: string) => {
    setAssignedCategories((prev) => prev.filter((c) => c.id !== catId));
  };

  return (
    <>
      <div className="fixed inset-0 z-50" onClick={onClose} />
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-[360px] flex-col shadow-2xl"
        style={{ backgroundColor: "var(--bg-panel)", borderLeft: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Inspector</h2>
            <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
          </div>
          <div className="mb-3 rounded-md p-3" style={{ backgroundColor: "var(--bg-secondary)" }}>
            <p
              className="text-sm italic leading-relaxed"
              style={{
                fontFamily: "'Lora', Georgia, serif",
                color: "var(--text-primary)",
                ...(expanded ? {} : { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }),
              }}
            >
              &ldquo;{segment.text}&rdquo;
            </p>
            {segment.text.length > 200 && (
              <button onClick={() => setExpanded((e) => !e)} className="mt-1 text-xs underline opacity-50 hover:opacity-80" style={{ color: "#000" }}>
                {expanded ? "Show less" : "See more"}
              </button>
            )}
          </div>
          <div className="mb-2 flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <FileText size={13} className="opacity-50" />
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>{segment.docName}</span>
            <span className="opacity-30">&rsaquo;</span>
            <span>P. {segment.page} &middot; &para; {segment.paragraph}</span>
          </div>
          <div className="mb-2 flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: segment.authorColor }}>
              {segment.authorName.charAt(0)}
            </span>
            <span className="font-medium" style={{ color: "var(--text-primary)" }}>{segment.authorName}</span>
            <span className="opacity-40">&middot; {segment.date}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => toast.info("Edit bounds", "Drag the selection handles in the document viewer to adjust")}
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-secondary)" }}>
              <Pencil size={12} /> Edit bounds
            </button>
            <button onClick={onDelete} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] hover:bg-red-50 min-touch" style={{ color: "#F44336" }}>
              <Trash2 size={12} /> Delete
            </button>
            <button onClick={handleCopy} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-secondary)" }}>
              <Copy size={12} /> Copy
            </button>
            <button onClick={onGoToDoc} className="flex items-center gap-1 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-secondary)" }}>
              <ArrowRight size={12} /> Go to doc
            </button>
            <button onClick={() => segment && openTTS(segment.text)}
              className="flex items-center gap-1 rounded px-2 py-1 text-[10px] hover:bg-gray-100 min-touch" style={{ color: "var(--text-secondary)" }}>
              <Volume2 size={12} /> Read
            </button>
            <button
              onClick={() => toggleKeyEvidence(segment.id)}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] min-touch ${isKeyEvidence ? "bg-yellow-100" : "hover:bg-gray-100"}`}
              style={{ color: isKeyEvidence ? "#F59E0B" : "var(--text-secondary)" }}
            >
              <Star size={12} fill={isKeyEvidence ? "#F59E0B" : "none"} />
              {isKeyEvidence ? "Key" : "Evidence"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-shrink-0 items-center justify-center border-b" style={{ borderColor: "var(--border)" }} role="tablist">
          {TAB_LIST.map((t, i) => {
            const Icon = t.icon;
            return (
              <div key={t.id} className="flex items-center">
                {i > 0 && <div className="mx-1 h-4 w-px" style={{ backgroundColor: "var(--border)" }} />}
                <button
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center justify-center gap-1 px-3 py-2 text-[13px] font-medium transition-colors min-touch ${tab === t.id ? "" : "opacity-50 hover:opacity-80"}`}
                  style={{
                    color: "#000",
                    borderBottom: tab === t.id ? "2px solid var(--peach)" : "2px solid transparent",
                  }}
                >
                  <Icon size={12} /> {t.label}
                </button>
              </div>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {/* Categories */}
          {tab === "categories" && (
            <div className="space-y-3">
              {assignedCategories.map((cat) => (
                <div key={cat.id} className="flex items-center gap-2 rounded-md border p-2.5" style={{ borderColor: "var(--border)" }}>
                  <span className="inline-block h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                  <span className="flex-1 text-xs font-medium" style={{ color: "var(--text-primary)" }}>{cat.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] opacity-30">Weight</span>
                    <input type="range" min={1} max={100} value={cat.weight}
                      onChange={(e) => updateWeight(cat.id, Number(e.target.value))}
                      className="w-[60px]" style={{ accentColor: cat.color }} />
                    <span className="w-7 text-right text-[10px] font-mono opacity-50">{cat.weight}</span>
                  </div>
                  <button onClick={() => removeCategory(cat.id)} className="flex-shrink-0 rounded p-0.5 hover:bg-gray-100 opacity-30 hover:opacity-100">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button onClick={() => toast.info("Add category", "Select a category from the left panel or create a new one")}
                className="flex w-full items-center justify-center gap-1 rounded-md border py-2 text-xs font-medium hover:bg-gray-50 min-touch"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                <Plus size={12} /> Add category
              </button>
            </div>
          )}

          {/* Paraphrases */}
          {tab === "paraphrases" && (
            <div className="space-y-3">
              <textarea value={paraphrase} onChange={(e) => setParaphrase(e.target.value)}
                placeholder="Write a paraphrase of this segment..." rows={4}
                className="w-full resize-none rounded-md border px-3 py-2 text-sm outline-none"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
              <div className="flex items-center gap-2">
                <select value={paraphraseCat} onChange={(e) => setParaphraseCat(e.target.value)}
                  className="rounded border bg-transparent px-2 py-1.5 text-xs outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  <option value="">Category (optional)</option>
                  {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
                <button disabled={!paraphrase.trim()}
                  className="flex items-center gap-1.5 rounded-md bg-peach-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-peach-700 disabled:opacity-40 min-touch">
                  <Save size={12} /> Save
                </button>
              </div>
            </div>
          )}

          {/* Comments */}
          {tab === "comments" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(); }}
                  placeholder="Add a comment..."
                  className="flex-1 rounded-md border px-3 py-1.5 text-xs outline-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }} />
                <button onClick={handleAddComment} disabled={!newComment.trim()}
                  className="rounded-md bg-peach-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-peach-700 disabled:opacity-40">Post</button>
              </div>
              {comments.map((c) => (
                <div key={c.id} className="rounded-md border p-2.5" style={{ borderColor: "var(--border)" }}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{c.author}</span>
                    <span className="text-[10px] opacity-40">{c.date}</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-80">{c.text}</p>
                  {c.isMine && (
                    <div className="mt-1.5 flex gap-1">
                      <button onClick={() => {
                        const newText = prompt("Edit comment:", c.text);
                        if (newText) setLocalComments((prev) => prev.map((cm) => cm.id === c.id ? { ...cm, text: newText, date: "Just now" } : cm));
                      }} className="rounded p-0.5 hover:bg-gray-100 text-[10px] opacity-40 hover:opacity-80"><Pencil size={11} /></button>
                      <button onClick={() => {
                        setLocalComments((prev) => prev.filter((cm) => cm.id !== c.id));
                        toast.success("Deleted", "Comment removed");
                      }} className="rounded p-0.5 hover:bg-red-50 text-[10px] text-red-400 hover:text-red-600"><Trash2 size={11} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Links */}
          {tab === "links" && (
            <div className="space-y-2">
              {links.map((l) => (
                <div key={l.id} className="flex items-start gap-2 rounded-md border p-2.5" style={{ borderColor: "var(--border)" }}>
                  <span className="mt-0.5 text-[10px] font-bold"
                    style={{ color: l.direction === "to" ? "#4CAF50" : "#2196F3" }}>
                    {l.direction === "to" ? "→" : "←"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="rounded-full px-1.5 py-0 text-[9px] font-medium"
                        style={{ backgroundColor: l.direction === "to" ? "#E8F5E9" : "#E3F2FD", color: l.direction === "to" ? "#2E7D32" : "#1565C0" }}>
                        {l.label}
                      </span>
                      <span className="opacity-30">{l.targetDoc}</span>
                    </div>
                    <p className="mt-1 text-xs italic opacity-60 truncate">&ldquo;{l.targetText}&rdquo;</p>
                  </div>
                </div>
              ))}
              <button onClick={() => toast.info("Link", "Open the Links tool in Analysis → Links to connect segments")}
                className="flex w-full items-center justify-center gap-1 rounded-md border py-2 text-xs font-medium hover:bg-gray-50 min-touch"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                <Plus size={12} /> Link to another segment
              </button>
            </div>
          )}

          {/* Info */}
          {tab === "info" && (
            <div className="space-y-2 text-xs">
              {[
                { label: "ID", value: segment.id },
                { label: "Type", value: "Text selection" },
                { label: "Start", value: `Pos ${segment.startPos}` },
                { label: "End", value: `Pos ${segment.endPos}` },
                { label: "Length", value: `${segment.endPos - segment.startPos} chars` },
                { label: "Created", value: segment.createdAt },
                { label: "Updated", value: segment.updatedAt },
              ].map((row) => (
                <div key={row.label} className="flex justify-between">
                  <span className="opacity-40">{row.label}</span>
                  <span className="font-mono text-[11px]" style={{ color: "var(--text-primary)" }}>{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default SegmentInspector;
