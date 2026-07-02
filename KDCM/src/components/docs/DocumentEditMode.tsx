import { useState } from "react";
import { Edit, Save, X, Search, RotateCcw, Replace, AlertTriangle } from "lucide-react";
import { useToast } from "../../stores/toastStore";

interface Props {
  documentName: string;
  initialContent: string;
  onSave: (content: string) => void;
  onClose: () => void;
}

export function DocumentEditMode({ documentName, initialContent, onSave, onClose }: Props) {
  const [content, setContent] = useState(initialContent || "");
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [edited, setEdited] = useState(false);
  const [hasCitations] = useState(true); // Simulated
  const { toast } = useToast();

  const handleSave = () => {
    onSave(content);
    toast.success("Saved", "Document saved. Citations recalculated.");
    setEdited(false);
  };

  const handleFindReplace = () => {
    if (!findText) return;
    const count = (content.match(new RegExp(findText, "gi")) || []).length;
    setContent(content.replace(new RegExp(findText, "gi"), replaceText));
    toast.success("Replaced", `${count} occurrences replaced`);
    setShowFindReplace(false);
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
        <div className="flex items-center gap-1.5">
          <Edit size={14} style={{ color: "#000" }} />
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Editing: {documentName}</span>
        </div>

        {/* Citation warning */}
        {hasCitations && (
          <div className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px]"
            style={{ backgroundColor: "#FFF9C4", color: "#F57F17" }}>
            <AlertTriangle size={10} />
            Editing within coded citations
          </div>
        )}

        <div className="flex-1" />

        {/* Find/Replace */}
        <button onClick={() => setShowFindReplace(!showFindReplace)}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch"
          style={{ color: "var(--text-secondary)" }}>
          <Search size={11} /> Find & Replace
        </button>

        <div className="w-px h-5 opacity-20" style={{ backgroundColor: "var(--text-secondary)" }} />

        <button onClick={() => { setContent(initialContent); setEdited(false); }}
          className="flex items-center gap-1 rounded px-2 py-1 text-[11px] hover:bg-gray-100 min-touch"
          style={{ color: "var(--text-secondary)" }} disabled={!edited}>
          <RotateCcw size={11} /> Revert
        </button>

        <button onClick={handleSave}
          className="flex items-center gap-1 rounded-md bg-peach-500 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-peach-700 min-touch"
          disabled={!edited}>
          <Save size={11} /> Save
        </button>

        <button onClick={onClose}
          className="rounded p-1 hover:bg-gray-100"><X size={14} /></button>
      </div>

      {/* Find/Replace panel */}
      {showFindReplace && (
        <div className="border-b px-4 py-2.5 flex items-center gap-2" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
          <Search size={12} opacity={0.3} />
          <input value={findText} onChange={(e) => setFindText(e.target.value)}
            placeholder="Find..."
            className="rounded border px-2.5 py-1.5 text-xs outline-none w-[180px]"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
          <Replace size={12} opacity={0.3} />
          <input value={replaceText} onChange={(e) => setReplaceText(e.target.value)}
            placeholder="Replace with..."
            className="rounded border px-2.5 py-1.5 text-xs outline-none w-[180px]"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
          <button onClick={handleFindReplace}
            className="rounded bg-peach-500 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-peach-700 min-touch">
            Replace all
          </button>
          <button onClick={() => setShowFindReplace(false)}
            className="rounded px-2 py-1.5 text-[10px] hover:bg-gray-100 min-touch"
            style={{ color: "var(--text-secondary)" }}>Cancel</button>
        </div>
      )}

      {/* Editor */}
      <textarea
        value={content}
        onChange={(e) => { setContent(e.target.value); setEdited(true); }}
        className="flex-1 w-full resize-none p-8 text-[15px] leading-relaxed outline-none"
        style={{
          fontFamily: "'Lora', Georgia, serif",
          backgroundColor: "#fff",
          color: "#1A1A1A",
          lineHeight: 1.8,
        }}
        placeholder="Start editing..."
      />

      {/* Status bar */}
      <div className="flex items-center gap-4 border-t px-4 py-1.5 text-[10px] opacity-30" style={{ borderColor: "var(--border)" }}>
        <span>{content.length} characters</span>
        <span>{content.split(/\n+/).length} paragraphs</span>
        <span>{content.split(/\s+/).length} words</span>
        {edited && <span style={{ color: "#000" }}>● Unsaved changes</span>}
        {hasCitations && <span style={{ color: "#F57F17" }}>⚠ Has coded citations</span>}
      </div>
    </div>
  );
}

export default DocumentEditMode;
