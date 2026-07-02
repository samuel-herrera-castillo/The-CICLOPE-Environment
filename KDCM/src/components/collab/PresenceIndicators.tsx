import { useCollabStore } from "../../stores/collabStore";
import { useLayoutStore } from "../../stores/layoutStore";
import { Users, ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";

/**
 * Avatars in the Navbar — shows up to 5 connected researchers.
 * Extra researchers shown as "+N".
 */
export function NavbarPresenceAvatars() {
  const session = useCollabStore((s) => s.session);
  const setPestañaPrincipal = useLayoutStore((s) => s.setPestañaPrincipal);
  const setSelectedDocId = useLayoutStore((s) => s.setSelectedDocId);

  if (!session || session.participants.length === 0) return null;

  const visible = session.participants.slice(0, 5);
  const overflow = session.participants.length - 5;

  return (
    <div className="flex items-center gap-0.5">
      {/* Pulse indicator */}
      <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse mr-1" title="Session active" />
      {visible.map((p) => (
        <button
          key={p.id}
          onClick={() => {
            if (p.currentDoc) setSelectedDocId(p.currentDoc);
            setPestañaPrincipal("equipo");
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white border-2 transition-transform hover:scale-110"
          style={{ backgroundColor: p.color, borderColor: "var(--bg-primary)" }}
          title={`${p.name}${p.currentDoc ? ` → ${p.currentDoc}` : ""}${p.cursor ? ` Pg.${p.cursor.position}` : ""}`}
        >
          {p.name.charAt(0).toUpperCase()}
        </button>
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold border-2"
          style={{ backgroundColor: "var(--bg-secondary)", borderColor: "var(--bg-primary)", color: "var(--text-secondary)" }}
          title={`+${overflow} more`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}

/**
 * Cursor indicator in the document viewer margin.
 * Shows colored line with initial for each remote researcher viewing the same document.
 */
export function DocumentPresenceCursors({ docId }: { docId: string }) {
  const session = useCollabStore((s) => s.session);
  if (!session) return null;

  const others = session.participants.filter(
    (p) => p.cursor?.docId === docId && p.online && p.id !== "me"
  );

  if (others.length === 0) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-10">
      {others.map((p) => (
        <div
          key={p.id}
          className="absolute flex items-center gap-1 transition-all duration-150"
          style={{
            left: 0,
            top: `${Math.min((p.cursor?.position || 0) * 100, 90)}%`,
            transform: `translateY(-50%)`,
          }}
          title={`${p.name} is here`}
        >
          <div className="h-8 w-0.5 rounded" style={{ backgroundColor: p.color }} />
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-bold text-white"
            style={{ backgroundColor: p.color }}
          >
            {p.name.charAt(0)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Activity log panel — collapsible panel at the bottom showing live events.
 */
export function ActivityLogPanel() {
  const session = useCollabStore((s) => s.session);
  const activityLog = useCollabStore((s) => s.activityLog);
  const [expanded, setExpanded] = useState(false);

  if (!session || activityLog.length === 0) return null;

  return (
    <div
      className="border-t transition-all"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "#1E2028",
        height: expanded ? 200 : 32,
        overflow: "hidden",
      }}
    >
      {/* Toggle bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 h-8 text-xs hover:bg-white/5"
        style={{ color: "var(--text-secondary)" }}
      >
        <Users size={12} />
        <span>Activity</span>
        <span className="opacity-40">({activityLog.length})</span>
        <div className="flex-1" />
        {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>

      {/* Events list */}
      {expanded && (
        <div className="overflow-y-auto px-3 pb-2" style={{ height: 168 }}>
          <div className="space-y-0.5">
            {activityLog.slice(-50).reverse().map((ev, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] py-0.5">
                <span className="text-[10px] opacity-40 flex-shrink-0 font-mono">{ev.time}</span>
                <span className="font-medium" style={{ color: "var(--text-primary)" }}>{ev.user}</span>
                <span className="opacity-60">→ {ev.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default { NavbarPresenceAvatars, DocumentPresenceCursors, ActivityLogPanel };
