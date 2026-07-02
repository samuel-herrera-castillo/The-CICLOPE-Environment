import { useState, useRef, useCallback } from "react";
import { Bold, Italic, Underline, Strikethrough, Heading2, Heading3, List, ListOrdered, Quote, Link, Bookmark, Star, Search, Plus, X, ArrowUpDown, Minus, Code, Volume2 } from "lucide-react";
import { useProjectStore, type Memo } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import { useTTSStore } from "../../stores/ttsStore";

interface Props {
  memo: Memo | null;
  onCreate?: () => void;
}

const TAG_COLORS = ["#F44336","#F1D7FF","#FFC107","#4CAF50","#2196F3","#9C27B0","#795548","#607D8B"];

type MarkdownToken = [string, string];

const MARKDOWN_WRAP: Record<string, MarkdownToken> = {
  Bold: ["**", "**"], Italic: ["*", "*"], Underline: ["<u>", "</u>"], Strikethrough: ["~~", "~~"],
  H2: ["\n## ", ""], H3: ["\n### ", ""], Bullet: ["\n- ", ""], Numbered: ["\n1. ", ""], Blockquote: ["\n> ", ""],
  Link: ["[", "](url)"], Reference: ["@", ""], Code: ["`", "`"], Rule: ["\n---\n", ""],
};

export function MemoEditor({ memo, onCreate }: Props) {
  const [title, setTitle] = useState(memo?.title ?? "");
  const [content, setContent] = useState(memo?.content ?? "");
  const [showMention, setShowMention] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [search, setSearch] = useState("");
  const [filterFav, setFilterFav] = useState(false);
  const [sort, setSort] = useState<"date" | "title">("date");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const memos = useProjectStore((s) => s.memos);
  const updateMemo = useProjectStore((s) => s.updateMemo);
  const addMemo = useProjectStore((s) => s.addMemo);
  const categories = useProjectStore((s) => s.categories);
  const documents = useProjectStore((s) => s.documents);
  const { toast } = useToast();
  const openTTS = useTTSStore((s) => s.open);

  const handleSave = () => {
    if (!title.trim()) return;
    if (memo) {
      updateMemo(memo.id, { title: title.trim(), content, updatedAt: new Date().toISOString() });
      toast.success("Saved", "Memo updated");
    } else {
      addMemo({
        id: `memo-${Date.now()}`, title: title.trim(), content,
        linkedDocIds: [], linkedCodeIds: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      toast.success("Created", "New memo saved");
      onCreate?.();
    }
  };

  const applyMarkdown = useCallback((tokenKey: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const [startToken, endToken] = MARKDOWN_WRAP[tokenKey] || ["", ""];
    const s = ta.selectionStart;
    const e = ta.selectionEnd;
    const selected = content.substring(s, e);
    const newText = content.substring(0, s) + startToken + selected + endToken + content.substring(e);
    setContent(newText);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + startToken.length, e + startToken.length); }, 0);
  }, [content]);

  // Filter & sort memos
  let visibleMemos = memos;
  if (search) visibleMemos = visibleMemos.filter((m) => m.title.toLowerCase().includes(search.toLowerCase()) || m.content.toLowerCase().includes(search.toLowerCase()));
  if (filterFav) visibleMemos = visibleMemos.filter((m) => (m as any).favorite);
  if (sort === "date") visibleMemos = [...visibleMemos].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  else visibleMemos = [...visibleMemos].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="flex h-full" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Memo list sidebar */}
      <div className="w-[260px] flex-shrink-0 flex flex-col border-r" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <div className="border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Search size={13} opacity={0.4} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search memos..."
              className="flex-1 bg-transparent text-xs outline-none" style={{ color: "var(--text-primary)" }} />
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setFilterFav((f) => !f)}
              className={`rounded-full px-2 py-0.5 text-[10px] min-touch ${filterFav ? "bg-yellow-100 text-yellow-700" : "hover:bg-gray-100"}`}
              style={{ color: filterFav ? undefined : "var(--text-secondary)" }}>⭐ Fav</button>
            <button onClick={() => setSort((s) => s === "date" ? "title" : "date")}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] hover:bg-gray-100 min-touch"
              style={{ color: "var(--text-secondary)" }}><ArrowUpDown size={10} /> {sort === "date" ? "Date" : "Title"}</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {visibleMemos.map((m) => (
            <div key={m.id} className="border-b px-3 py-2 text-xs cursor-pointer hover:bg-gray-50" style={{ borderColor: "var(--border)" }}
              onClick={() => { setTitle(m.title); setContent(m.content); }}>
              <div className="flex items-center gap-1.5">
                {(m as any).favorite && <Star size={11} fill="#F59E0B" color="#F59E0B" />}
                <span className="font-medium truncate flex-1" style={{ color: "var(--text-primary)" }}>{m.title}</span>
              </div>
              <p className="mt-0.5 truncate opacity-40">{m.content.slice(0, 60)}</p>
            </div>
          ))}
        </div>
        <div className="border-t px-3 py-2" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => { setTitle(""); setContent(""); }}
            className="flex w-full items-center justify-center gap-1 rounded-md bg-peach-500 py-1.5 text-xs font-medium text-white hover:bg-peach-700">
            <Plus size={12} /> New memo
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 border-b px-3 py-1.5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
          <button onClick={() => setFavorite((f) => !f)}
            className={`rounded p-1 min-touch ${favorite ? "text-yellow-500" : "opacity-40 hover:opacity-80"}`}
            style={{ color: favorite ? "#F59E0B" : "var(--text-secondary)" }} title="Favorite">
            <Star size={14} fill={favorite ? "#F59E0B" : "none"} />
          </button>
          <div className="w-px h-4 opacity-20 mx-1" style={{ backgroundColor: "var(--text-secondary)" }} />
          {/* Formatting buttons — each inserts markdown tokens */}
          {[
            { Icon: Bold, key: "Bold" }, { Icon: Italic, key: "Italic" }, { Icon: Underline, key: "Underline" }, { Icon: Strikethrough, key: "Strikethrough" },
          ].map(({ Icon, key }, i) => (
            <button key={i} onClick={() => applyMarkdown(key)}
              className="rounded p-1.5 hover:bg-gray-100 min-touch opacity-50 hover:opacity-100" title={key}>
              <Icon size={14} />
            </button>
          ))}
          <div className="w-px h-4 opacity-20 mx-1" style={{ backgroundColor: "var(--text-secondary)" }} />
          {[
            { Icon: Heading2, key: "H2" }, { Icon: Heading3, key: "H3" }, { Icon: List, key: "Bullet" }, { Icon: ListOrdered, key: "Numbered" }, { Icon: Quote, key: "Blockquote" },
          ].map(({ Icon, key }, i) => (
            <button key={i} onClick={() => applyMarkdown(key)}
              className="rounded p-1.5 hover:bg-gray-100 min-touch opacity-50 hover:opacity-100" title={key}>
              <Icon size={14} />
            </button>
          ))}
          <button onClick={() => applyMarkdown("Link")} className="rounded p-1.5 hover:bg-gray-100 min-touch opacity-50 hover:opacity-100" title="Insert link"><Link size={14} /></button>
          <button onClick={() => applyMarkdown("Reference")} className="rounded p-1.5 hover:bg-gray-100 min-touch opacity-50 hover:opacity-100" title="Reference @"><Bookmark size={14} /></button>
          <div className="w-px h-4 opacity-20 mx-1" style={{ backgroundColor: "var(--text-secondary)" }} />
          <button onClick={() => applyMarkdown("Code")} className="rounded p-1.5 hover:bg-gray-100 min-touch opacity-50 hover:opacity-100" title="Code"><Code size={14} /></button>
          <button onClick={() => applyMarkdown("Rule")} className="rounded p-1.5 hover:bg-gray-100 min-touch opacity-50 hover:opacity-100" title="Horizontal rule"><Minus size={14} /></button>
          <div className="flex-1" />
          {/* TTS button */}
          <button onClick={() => { if (content.trim()) openTTS(content); }}
            className="rounded p-1.5 hover:bg-gray-100 min-touch opacity-50 hover:opacity-100" title="Read aloud">
            <Volume2 size={14} />
          </button>
        </div>

        {/* Title + Content (unchanged from here down) */}
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Memo title..." className="border-b px-4 py-3 text-lg font-bold outline-none"
          style={{ borderColor: "var(--border)", backgroundColor: "transparent", color: "var(--text-primary)" }} />
        <div className="relative flex-1">
          <textarea ref={textareaRef} value={content} onChange={(e) => {
            const val = e.target.value;
            setContent(val);
            const lastAt = val.lastIndexOf("@");
            if (lastAt >= 0 && (lastAt === 0 || val[lastAt - 1] === " ")) {
              setShowMention(true);
              setMentionFilter(val.slice(lastAt + 1));
            } else setShowMention(false);
          }}
            placeholder="Start writing... Use @ to mention categories (@), documents (#), memos (&)"
            className="h-full w-full resize-none px-4 py-3 text-sm outline-none leading-relaxed"
            style={{ backgroundColor: "transparent", color: "var(--text-primary)", fontFamily: "'Lora', Georgia, serif" }} />
          {showMention && (
            <div className="absolute left-4 top-10 z-50 w-[280px] rounded-md border bg-white py-1 shadow-lg"
              style={{ borderColor: "var(--border)" }}>
              <div className="px-2.5 py-1 text-[10px] font-semibold opacity-30 uppercase">Categories</div>
              {categories.filter((c) => !mentionFilter || c.name.toLowerCase().includes(mentionFilter.toLowerCase())).slice(0, 4).map((c) => (
                <button key={c.id} onClick={() => {
                  const lastAt = content.lastIndexOf("@");
                  setContent(content.slice(0, lastAt) + `@${c.name} ` + content.slice(content.indexOf(" ", lastAt) >= 0 ? content.indexOf(" ", lastAt) : content.length));
                  setShowMention(false);
                }} className="flex w-full items-center gap-2 px-2.5 py-1 text-xs hover:bg-gray-100" style={{ color: "var(--text-primary)" }}>
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} /> {c.name}
                </button>
              ))}
              <div className="px-2.5 py-1 text-[10px] font-semibold opacity-30 uppercase">Documents</div>
              {documents.filter((d) => !mentionFilter || d.name.toLowerCase().includes(mentionFilter.toLowerCase())).slice(0, 3).map((d) => (
                <button key={d.id} onClick={() => {
                  const lastAt = content.lastIndexOf("@");
                  setContent(content.slice(0, lastAt) + `#${d.name} ` + content.slice(content.indexOf(" ", lastAt) >= 0 ? content.indexOf(" ", lastAt) : content.length));
                  setShowMention(false);
                }} className="flex w-full items-center gap-2 px-2.5 py-1 text-xs hover:bg-gray-100" style={{ color: "var(--text-primary)" }}>
                  📄 {d.name}
                </button>
              ))}
              <div className="px-2.5 py-1 text-[10px] font-semibold opacity-30 uppercase">Segments</div>
              <button onClick={() => { const lastAt = content.lastIndexOf("@");
                setContent(content.slice(0, lastAt) + `📌"${mentionFilter}" ` + content.slice(lastAt + mentionFilter.length + 1));
                setShowMention(false);
              }} className="flex w-full items-center gap-2 px-2.5 py-1 text-xs hover:bg-gray-100" style={{ color: "var(--text-primary)" }}>
                📌 Reference: "{mentionFilter}"
              </button>
              <div className="px-2.5 py-1 text-[10px] font-semibold opacity-30 uppercase">Memos</div>
              {memos.filter((m) => !mentionFilter || m.title.toLowerCase().includes(mentionFilter.toLowerCase())).slice(0, 3).map((m) => (
                <button key={m.id} onClick={() => {
                  const lastAt = content.lastIndexOf("@");
                  setContent(content.slice(0, lastAt) + `📝${m.title} ` + content.slice(content.indexOf(" ", lastAt) >= 0 ? content.indexOf(" ", lastAt) : content.length));
                  setShowMention(false);
                }} className="flex w-full items-center gap-2 px-2.5 py-1 text-xs hover:bg-gray-100" style={{ color: "var(--text-primary)" }}>
                  📝 {m.title}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 border-t px-4 py-2" style={{ borderColor: "var(--border)" }}>
          {tags.map((t, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: TAG_COLORS[i % TAG_COLORS.length] + "20", color: TAG_COLORS[i % TAG_COLORS.length] }}>
              {t} <button onClick={() => setTags((prev) => prev.filter((_, j) => j !== i))} className="hover:opacity-60"><X size={10} /></button>
            </span>
          ))}
          <input value={newTag} onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newTag.trim()) { setTags((prev) => [...prev, newTag.trim()]); setNewTag(""); } }}
            placeholder="+ Tag..." className="w-20 bg-transparent text-[10px] outline-none" style={{ color: "var(--text-secondary)" }} />
          <div className="flex-1" />
          <button onClick={handleSave}
            className="rounded-md bg-peach-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-peach-700 min-touch">Save</button>
        </div>
      </div>
    </div>
  );
}

export default MemoEditor;
