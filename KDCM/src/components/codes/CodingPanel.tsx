import { useState, useCallback } from "react";
import { Tag, Sparkles, Bookmark, Star, Layers, X } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useCodingStore } from "../../stores/codingStore";
import { useToast } from "../../stores/toastStore";
import { CategorySelector } from "./CategorySelector";

interface CodingPanelProps {
  selectedText: string;
  documentId: string;
  segmentId?: string;
  onClose: () => void;
  onApplyCoding?: (categoryId: string, weight: number) => void;
}

/**
 * Floating coding panel — shown when text is selected.
 *
 * Features:
 * - Quick actions: Code, In Vivo (Shift+Ctrl+V), Free segment (Ctrl+M),
 *   Quick code (Ctrl+L), Key evidence (⭐)
 * - Opens CategorySelector on "Code" click
 * - Mass categorization via Ctrl+click on existing segments
 */
export function CodingPanel({
  selectedText, documentId: _docId, segmentId, onClose, onApplyCoding,
}: CodingPanelProps) {
  const categories = useProjectStore((s) => s.categories);
  const addCategory = useProjectStore((s) => s.addCategory);
  const updateCategory = useProjectStore((s) => s.updateCategory);

  const lastCategoryId = useCodingStore((s) => s.lastCategoryId);
  const pushRecent = useCodingStore((s) => s.pushRecent);
  const toggleKeyEvidence = useCodingStore((s) => s.toggleKeyEvidence);
  const keyEvidence = useCodingStore((s) => s.keyEvidence);
  const selectedSegments = useCodingStore((s) => s.selectedSegments);
  const clearSelection = useCodingStore((s) => s.clearSelection);

  const { toast } = useToast();

  const [showSelector, setShowSelector] = useState(false);
  const isKeyEvidence = segmentId ? keyEvidence.includes(segmentId) : false;

  // ── In Vivo: create category from selected text ──
  const handleInVivo = useCallback(() => {
    const name = selectedText.slice(0, 80).trim();
    if (!name) return;
    const color = `#${Math.floor(0 * 0xffffff).toString(16).padStart(6, "0")}`;
    addCategory({
      id: `iv-${Date.now()}`,
      name,
      color,
      parentId: null,
      count: 1,
      es_in_vivo: true,
    });
    toast.success("In vivo code created", `"${name}"`);
    onApplyCoding?.(`iv-${Date.now()}`, 50);
    onClose();
  }, [selectedText, addCategory, toast, onApplyCoding, onClose]);

  // ── Free segment (no category, dashed border) ──
  const handleFreeSegment = useCallback(() => {
    toast.info("Free segment", "Uncategorized — assign a code later");
    onApplyCoding?.("__free__", 0);
    onClose();
  }, [toast, onApplyCoding, onClose]);

  // ── Quick code (Ctrl+L): apply last category ──
  const handleQuickCode = useCallback(() => {
    if (!lastCategoryId) {
      toast.info("No previous code", "Apply a category first to use quick coding");
      return;
    }
    pushRecent(lastCategoryId);
    onApplyCoding?.(lastCategoryId, 50);
    toast.success("Quick coded", `Applied ${categories.find((c) => c.id === lastCategoryId)?.name ?? "category"}`);
    onClose();
  }, [lastCategoryId, pushRecent, onApplyCoding, toast, categories, onClose]);

  // ── Key evidence toggle ──
  const handleKeyEvidence = useCallback(() => {
    if (!segmentId) return;
    toggleKeyEvidence(segmentId);
    const isNow = !isKeyEvidence;
    toast.success(isNow ? "Marked as key evidence ⭐" : "Removed key evidence");
  }, [segmentId, toggleKeyEvidence, isKeyEvidence, toast]);

  // ── Apply from selector ──
  const handleApplyCategory = useCallback((categoryId: string, weight: number) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (cat) updateCategory(categoryId, { count: cat.count + 1 });
    pushRecent(categoryId);
    onApplyCoding?.(categoryId, weight);

    // Mass categorization
    if (selectedSegments.length > 0) {
      toast.success("Mass coding", `Coding ${selectedSegments.length + 1} selected segments`);
      clearSelection();
    }
  }, [categories, updateCategory, pushRecent, onApplyCoding, selectedSegments, toast, clearSelection]);

  return (
    <>
      <div
        className="rounded-lg border p-3 shadow-xl"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "#1E2028",
          maxWidth: 340,
        }}
      >
        {/* Header */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-white">Code selection</span>
          <button onClick={onClose} className="rounded p-0.5 hover:bg-white/10">
            <X size={14} color="#E0E0E0" />
          </button>
        </div>

        {/* Selected text preview */}
        <div
          className="mb-3 max-h-14 overflow-y-auto rounded border p-2 text-xs italic"
          style={{
            borderColor: "rgba(255,255,255,0.1)",
            backgroundColor: "rgba(255,255,255,0.04)",
            color: "#B0B0B0",
            fontFamily: "'Lora', Georgia, serif",
          }}
        >
          &ldquo;{selectedText.length > 120 ? selectedText.slice(0, 120) + "..." : selectedText}&rdquo;
        </div>

        {/* ── Quick action buttons grid 2×2 ── */}
        <div className="mb-2 grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setShowSelector(true)}
            className="flex items-center gap-1.5 rounded px-2.5 py-2 text-xs font-medium bg-peach-500 text-white hover:bg-peach-700 transition-colors"
          >
            <Tag size={13} /> Code
          </button>
          <button
            onClick={handleInVivo}
            className="flex items-center gap-1.5 rounded px-2.5 py-2 text-xs font-medium bg-white/5 text-white hover:bg-white/10 transition-colors"
            title="Shift+Ctrl+V"
          >
            <Sparkles size={13} /> In vivo
          </button>
          <button
            onClick={handleFreeSegment}
            className="flex items-center gap-1.5 rounded px-2.5 py-2 text-xs font-medium bg-white/5 text-white hover:bg-white/10 transition-colors"
            title="Ctrl+M"
          >
            <Bookmark size={13} /> Free segment
          </button>
          <button
            onClick={handleQuickCode}
            className="flex items-center gap-1.5 rounded px-2.5 py-2 text-xs font-medium bg-white/5 text-white hover:bg-white/10 transition-colors"
            title="Ctrl+L"
          >
            <Layers size={13} /> Quick code
          </button>
        </div>

        {/* Key evidence */}
        {segmentId && (
          <button
            onClick={handleKeyEvidence}
            className={`flex w-full items-center justify-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
              isKeyEvidence ? "bg-yellow-500/20 text-yellow-400" : "bg-white/5 text-white/50 hover:bg-white/10"
            }`}
          >
            <Star size={13} fill={isKeyEvidence ? "#FBBF24" : "none"} />
            {isKeyEvidence ? "Key evidence ⭐" : "Mark as key evidence"}
          </button>
        )}

        {/* Mass selection info */}
        {selectedSegments.length > 0 && (
          <div className="mt-2 rounded border border-peach-500/30 bg-peach-500/10 px-2 py-1 text-[10px] text-peach-200">
            {selectedSegments.length} segment{selectedSegments.length > 1 ? "s" : ""} selected (Ctrl+click to add)
            <button onClick={clearSelection} className="ml-2 underline hover:opacity-80">Clear</button>
          </div>
        )}
      </div>

      {/* Category selector (sliding panel) */}
      <CategorySelector
        open={showSelector}
        selectedText={selectedText}
        segmentId={segmentId}
        onClose={() => setShowSelector(false)}
        onApply={handleApplyCategory}
      />
    </>
  );
}

export default CodingPanel;
