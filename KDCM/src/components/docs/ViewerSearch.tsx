import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, ChevronUp, ChevronDown } from "lucide-react";

interface Props {
  content: string;
  containerRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

export function ViewerSearch({ content, containerRef, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [onlyMarked, setOnlyMarked] = useState(false);
  const [onlyCoded, setOnlyCoded] = useState(false);
  const [matches, setMatches] = useState<number[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  // Clean up highlights on unmount
  useEffect(() => {
    return () => {
      const el = containerRef.current;
      if (el) {
        el.querySelectorAll("mark.kdcm-search-highlight").forEach((m) => {
          const parent = m.parentNode;
          if (parent) { parent.replaceChild(document.createTextNode(m.textContent || ""), m); parent.normalize(); }
        });
      }
    };
  }, []);

  // Apply/remove highlights in DOM
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Remove previous highlights
    el.querySelectorAll("mark.kdcm-search-highlight").forEach((m) => {
      const parent = m.parentNode;
      if (parent) { parent.replaceChild(document.createTextNode(m.textContent || ""), m); parent.normalize(); }
    });
    if (!query.trim() || matches.length === 0) return;
    // Walk text nodes and wrap matches
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
    // Simple approach: find and highlight first N matches
    let highlighted = 0;
    const maxHighlights = 200;
    textNodes.forEach((node) => {
      if (highlighted >= maxHighlights) return;
      const parent = node.parentNode;
      if (!parent) return;
      const txt = node.textContent || "";
      let pattern: RegExp;
      try {
        let source = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (wholeWord) source = "\\b" + source + "\\b";
        pattern = new RegExp(source, caseSensitive ? "g" : "gi");
      } catch { return; }
      const newNodes: Node[] = [];
      let lastIdx = 0;
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(txt)) !== null && highlighted < maxHighlights) {
        if (m.index > lastIdx) newNodes.push(document.createTextNode(txt.slice(lastIdx, m.index)));
        const mark = document.createElement("mark");
        mark.className = "kdcm-search-highlight";
        mark.textContent = m[0];
        mark.style.backgroundColor = highlighted === activeIdx ? "#FF9800" : "#FFEE8A";
        mark.style.color = "#1a1a1a";
        mark.style.borderRadius = "2px";
        mark.style.padding = "0 1px";
        newNodes.push(mark);
        lastIdx = m.index + m[0].length;
        highlighted++;
        if (m[0].length === 0) pattern.lastIndex++;
      }
      if (newNodes.length > 0) {
        if (lastIdx < txt.length) newNodes.push(document.createTextNode(txt.slice(lastIdx)));
        newNodes.forEach((n) => parent.insertBefore(n, node));
        parent.removeChild(node);
      }
    });
    // Update active highlight color
    let i = 0;
    el.querySelectorAll("mark.kdcm-search-highlight").forEach((m) => {
      (m as HTMLElement).style.backgroundColor = i === activeIdx ? "#FF9800" : "#FFEE8A";
      i++;
    });
  }, [query, matches, activeIdx, caseSensitive, wholeWord, useRegex]);

  const buildPattern = useCallback((q: string): RegExp | null => {
    if (!q.trim()) return null;
    try {
      let source = useRegex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (wholeWord) source = `\\b${source}\\b`;
      return new RegExp(source, caseSensitive ? "g" : "gi");
    } catch { return null; }
  }, [caseSensitive, wholeWord, useRegex]);

  useEffect(() => {
    const pattern = buildPattern(query);
    if (!pattern) { setMatches([]); setActiveIdx(0); return; }
    const found: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(content)) !== null) {
      found.push(m.index);
      if (m.index === pattern.lastIndex) pattern.lastIndex++;
    }
    setMatches(found);
    setActiveIdx(found.length > 0 ? 0 : -1);
  }, [query, buildPattern, content]);

  const scrollToMatch = (idx: number) => {
    const el = containerRef.current;
    if (!el || idx < 0 || idx >= matches.length) return;
    const ratio = matches[idx] / content.length;
    el.scrollTop = ratio * el.scrollHeight;
  };

  const handlePrev = () => {
    if (matches.length === 0) return;
    const next = activeIdx <= 0 ? matches.length - 1 : activeIdx - 1;
    setActiveIdx(next);
    scrollToMatch(next);
  };

  const handleNext = () => {
    if (matches.length === 0) return;
    const next = activeIdx >= matches.length - 1 ? 0 : activeIdx + 1;
    setActiveIdx(next);
    scrollToMatch(next);
  };

  return (
    <div className="flex h-[40px] items-center gap-1.5 border-b px-2 shadow-sm"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-panel)" }}>
      <Search size={14} opacity={0.3} />
      <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.shiftKey ? handlePrev() : handleNext(); } if (e.key === "Escape") onClose(); }}
        placeholder="Find in document... (Ctrl+F)"
        className="w-[180px] bg-transparent text-xs outline-none" style={{ color: "var(--text-primary)", border: matches.length === 0 && query ? "1px solid #F44336" : "none", borderRadius: 4, padding: "2px 6px" }} />

      {matches.length > 0 && (
        <span className="text-[10px] font-medium min-w-[50px] text-center" style={{ color: "var(--text-secondary)" }}>
          {activeIdx + 1} of {matches.length}
        </span>
      )}
      {matches.length === 0 && query.trim() && (
        <span className="text-[10px] font-medium" style={{ color: "#F44336" }}>No results</span>
      )}

      <div className="flex items-center gap-0.5">
        <button onClick={handlePrev} disabled={matches.length === 0} className="rounded p-1 hover:bg-gray-100 disabled:opacity-20" title="Prev (Shift+Enter)"><ChevronUp size={13} /></button>
        <button onClick={handleNext} disabled={matches.length === 0} className="rounded p-1 hover:bg-gray-100 disabled:opacity-20" title="Next (Enter)"><ChevronDown size={13} /></button>
      </div>

      <div className="w-px h-4 mx-1" style={{ backgroundColor: "var(--border)" }} />

      <button onClick={() => setCaseSensitive((v) => !v)}
        className={`rounded px-1.5 py-0.5 text-[10px] font-medium min-touch ${caseSensitive ? "" : "opacity-40"}`}
        style={{ backgroundColor: caseSensitive ? "var(--peach)" : "transparent", color: caseSensitive ? "#1a1a1a" : "var(--text-secondary)" }}>Aa</button>
      <button onClick={() => setWholeWord((v) => !v)}
        className={`rounded px-1.5 py-0.5 text-[10px] font-medium min-touch ${wholeWord ? "" : "opacity-40"}`}
        style={{ backgroundColor: wholeWord ? "var(--peach)" : "transparent", color: wholeWord ? "#1a1a1a" : "var(--text-secondary)" }}>\b</button>
      <button onClick={() => setUseRegex((v) => !v)}
        className={`rounded px-1.5 py-0.5 text-[10px] font-medium min-touch ${useRegex ? "" : "opacity-40"}`}
        style={{ backgroundColor: useRegex ? "var(--peach)" : "transparent", color: useRegex ? "#1a1a1a" : "var(--text-secondary)" }}>.*</button>

      <div className="w-px h-4 mx-1" style={{ backgroundColor: "var(--border)" }} />

      <label className="flex items-center gap-1 text-[9px] cursor-pointer opacity-40 hover:opacity-80" title="Only show pages with citations">
        <input type="checkbox" checked={onlyMarked} onChange={(e) => setOnlyMarked(e.target.checked)} style={{ accentColor: "var(--peach)" }} /> Marked
      </label>
      <label className="flex items-center gap-1 text-[9px] cursor-pointer opacity-40 hover:opacity-80" title="Only show already coded text">
        <input type="checkbox" checked={onlyCoded} onChange={(e) => setOnlyCoded(e.target.checked)} style={{ accentColor: "var(--peach)" }} /> Coded
      </label>

      <button onClick={onClose} className="rounded p-1 hover:bg-gray-100" title="Close (Esc)"><X size={14} /></button>
    </div>
  );
}

export default ViewerSearch;
