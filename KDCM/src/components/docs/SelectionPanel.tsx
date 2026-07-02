import { Tag, Bookmark, Edit3, MessageSquare, Link, Volume2, Sparkles } from "lucide-react";

interface SelectionPanelProps {
  x: number;
  y: number;
  selectedText: string;
  onClose: () => void;
  onAction: (action: string) => void;
}

interface PanelButton {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

const BUTTONS: PanelButton[] = [
  { id: "code",       label: "Code",        icon: Tag },
  { id: "invivo",     label: "In vivo",     icon: Sparkles },
  { id: "bookmark",   label: "Mark",        icon: Bookmark },
  { id: "paraphrase", label: "Paraphrase",  icon: Edit3 },
  { id: "comment",    label: "Comment",     icon: MessageSquare },
  { id: "link",       label: "Link",        icon: Link },
  { id: "listen",     label: "Listen",      icon: Volume2 },
];

/**
 * Floating selection panel — appears 8px above selected text.
 *
 * Background: #1E2028, border-radius 8px, shadow-xl
 * Animation: scale(0.9)→1 + fade-in 150ms
 * Buttons: 32×32px, hover bg rgba(255,255,255,0.1)
 */
export function SelectionPanel({ x, y, selectedText: _text, onClose, onAction }: SelectionPanelProps) {
  return (
    <>
      {/* Backdrop to catch clicks outside */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        className="fixed z-50 flex items-center gap-0.5 rounded-lg px-1.5 py-1 shadow-xl"
        style={{
          backgroundColor: "#1E2028",
          left: Math.max(8, Math.min(x, window.innerWidth - 300)),
          top: Math.max(8, y - 48),
          animation: "sel-panel-in 150ms ease-out",
        }}
        role="toolbar"
        aria-label="Selection actions"
      >
        {BUTTONS.map((btn) => {
          const Icon = btn.icon;
          return (
            <button
              key={btn.id}
              onClick={(e) => { e.stopPropagation(); onAction(btn.id); onClose(); }}
              className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-white/10 min-touch"
              style={{ color: "#E0E0E0" }}
              aria-label={btn.label}
              title={btn.label}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>

      <style>{`
        @keyframes sel-panel-in {
          from { transform: scale(0.9); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </>
  );
}

export default SelectionPanel;
