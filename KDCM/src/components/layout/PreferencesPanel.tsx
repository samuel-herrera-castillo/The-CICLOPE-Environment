import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Save, RotateCcw } from "lucide-react";
import { useUIStore, type Theme } from "../../stores/uiStore";
import { useToast } from "../../stores/toastStore";

interface Props { open: boolean; onClose: () => void; }

type PrefTab = "general" | "editor" | "coding" | "collab" | "shortcuts";

const DEFAULT_SHORTCUTS: { action: string; keys: string }[] = [
  { action: "shortcuts:categorize", keys: "Ctrl+J" },
  { action: "shortcuts:new_category", keys: "Ctrl+K" },
  { action: "shortcuts:last_code", keys: "Ctrl+L" },
  { action: "shortcuts:in_vivo", keys: "Shift+Ctrl+V" },
  { action: "shortcuts:next_segment", keys: "Ctrl+B" },
  { action: "shortcuts:prev_segment", keys: "Ctrl+Shift+B" },
  { action: "shortcuts:go_to_doc", keys: "Ctrl+D" },
  { action: "shortcuts:global_search", keys: "Ctrl+Shift+F" },
  { action: "shortcuts:undo", keys: "Ctrl+Z" },
  { action: "shortcuts:redo", keys: "Ctrl+Y" },
  { action: "shortcuts:preferences", keys: "Ctrl+," },
  { action: "shortcuts:snapshot", keys: "Ctrl+S" },
  { action: "shortcuts:rename", keys: "F2" },
  { action: "shortcuts:play_pause", keys: "P" },
  { action: "shortcuts:seek_back", keys: "F5" },
  { action: "shortcuts:seek_forward", keys: "F6" },
];

export function PreferencesPanel({ open, onClose }: Props) {
  const { t } = useTranslation(["settings", "common"]);
  const [tab, setTab] = useState<PrefTab>("general");
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const [fontSize, setFontSize] = useState(15);
  const [lineHeight, setLineHeight] = useState(1.6);
  const [marginWidth, setMarginWidth] = useState(60);
  const [autoSaveInterval, setAutoSaveInterval] = useState(30);
  const [showCursors, setShowCursors] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [presenceColor, setPresenceColor] = useState("#F1D7FF");
  const [editingShortcut, setEditingShortcut] = useState<string | null>(null);
  const { toast } = useToast();

  if (!open) return null;

  const handleSave = () => {
    toast.success("Saved", "Preferences saved");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-[700px] max-h-[85vh] rounded-xl shadow-2xl flex flex-col"
        style={{ backgroundColor: "var(--bg-panel)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>{t("preferences")}</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
          {(["general","editor","coding","collab","shortcuts"] as PrefTab[]).map((id) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2 text-xs font-medium min-touch ${tab === id ? "" : "opacity-50 hover:opacity-80"}`}
              style={{
                color: tab === id ? "#000" : "#000",
                borderBottom: tab === id ? "2px solid var(--peach)" : "2px solid transparent",
              }}>{t(`tab_${id}`)}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "general" && (
            <div className="space-y-4 max-w-[400px]">
              <div>
                <label className="block text-[10px] font-medium opacity-40 mb-1 uppercase">{t("theme")}</label>
                <div className="flex gap-2">
                  {(["system","light","dark"] as Theme[]).map((t) => (
                    <button key={t} onClick={() => setTheme(t)}
                      className={`rounded-lg border px-4 py-2 text-xs capitalize min-touch ${theme === t ? "border-peach-500 bg-peach-50" : "hover:bg-gray-50"}`}
                      style={{ borderColor: theme === t ? "var(--peach)" : "var(--border)", color: "var(--text-primary)" }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium opacity-40 mb-1 uppercase">{t("font_size_ui")}</label>
                <input type="range" min={12} max={20} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full" style={{ accentColor: "var(--peach)" }} />
                <span className="text-[10px] opacity-30">{fontSize}px</span>
              </div>
            </div>
          )}

          {tab === "editor" && (
            <div className="space-y-4 max-w-[400px]">
              <div>
                <label className="block text-[10px] font-medium opacity-40 mb-1 uppercase">{t("viewer_size")}</label>
                <input type="range" min={12} max={24} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full" style={{ accentColor: "var(--peach)" }} />
                <span className="text-[10px] opacity-30">{fontSize}px — Lora, Georgia, serif</span>
              </div>
              <div>
                <label className="block text-[10px] font-medium opacity-40 mb-1 uppercase">{t("line_height")}</label>
                <input type="range" min={1.2} max={2.5} step={0.1} value={lineHeight} onChange={(e) => setLineHeight(Number(e.target.value))}
                  className="w-full" style={{ accentColor: "var(--peach)" }} />
                <span className="text-[10px] opacity-30">{lineHeight}</span>
              </div>
              <div>
                <label className="block text-[10px] font-medium opacity-40 mb-1 uppercase">{t("margin_width")}</label>
                <input type="range" min={40} max={80} value={marginWidth} onChange={(e) => setMarginWidth(Number(e.target.value))}
                  className="w-full" style={{ accentColor: "var(--peach)" }} />
                <span className="text-[10px] opacity-30">{marginWidth}px</span>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-primary)" }}>
                <input type="checkbox" defaultChecked style={{ accentColor: "var(--peach)" }} /> Create citation on text selection
              </label>
            </div>
          )}

          {tab === "coding" && (
            <div className="space-y-4 max-w-[400px]">
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-primary)" }}>
                <input type="checkbox" defaultChecked style={{ accentColor: "var(--peach)" }} /> {t("accessible_palette")}
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-primary)" }}>
                <input type="checkbox" defaultChecked style={{ accentColor: "var(--peach)" }} /> {t("tooltip_on_segment")}
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-primary)" }}>
                <input type="checkbox" defaultChecked style={{ accentColor: "var(--peach)" }} /> {t("confirm_delete")}
              </label>
              <div>
                <label className="block text-[10px] font-medium opacity-40 mb-1 uppercase">{t("autosave_interval")}</label>
                <select value={autoSaveInterval} onChange={(e) => setAutoSaveInterval(Number(e.target.value))}
                  className="rounded border px-3 py-2 text-sm outline-none"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  <option value={15}>15 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>60 seconds</option>
                </select>
              </div>
            </div>
          )}

          {tab === "collab" && (
            <div className="space-y-4 max-w-[400px]">
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-primary)" }}>
                <input type="checkbox" checked={showCursors} onChange={(e) => setShowCursors(e.target.checked)}
                  style={{ accentColor: "var(--peach)" }} /> {t("show_cursors")}
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--text-primary)" }}>
                <input type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)}
                  style={{ accentColor: "var(--peach)" }} /> {t("notifications")}
              </label>
              <div>
                <label className="block text-[10px] font-medium opacity-40 mb-1 uppercase">{t("presence_color")}</label>
                <div className="flex gap-1.5">
                  {["#F1D7FF","#2196F3","#4CAF50","#9C27B0","#F1D7FF","#F44336","#00BCD4","#607D8B"].map((c) => (
                    <button key={c} onClick={() => setPresenceColor(c)}
                      className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                      style={{ backgroundColor: c, borderColor: presenceColor === c ? "var(--text-primary)" : "transparent" }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "shortcuts" && (
            <div>
              <p className="text-[10px] opacity-30 mb-3">Click a cell to capture a new shortcut</p>
              <div className="border rounded-md overflow-hidden" style={{ borderColor: "var(--border)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: "var(--bg-secondary)" }}>
                      <th className="px-3 py-1.5 text-left font-medium opacity-40">{t("common:actions")}</th>
                      <th className="px-3 py-1.5 text-right font-medium opacity-40 w-[140px]">Shortcut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEFAULT_SHORTCUTS.map((sc) => (
                      <tr key={sc.action} className="border-t" style={{ borderColor: "var(--border)" }}>
                        <td className="px-3 py-1.5" style={{ color: "var(--text-primary)" }}>{t(sc.action)}</td>
                        <td className="px-3 py-1.5 text-right">
                          {editingShortcut === sc.action ? (
                            <input autoFocus className="text-right font-mono text-[11px] rounded border px-1.5 py-0.5 outline-none w-[100px]"
                              style={{ borderColor: "var(--peach)", color: "var(--text-primary)" }}
                              defaultValue={sc.keys}
                              onBlur={() => setEditingShortcut(null)}
                              onKeyDown={(e) => { e.preventDefault(); setEditingShortcut(null); }} />
                          ) : (
                            <button onClick={() => setEditingShortcut(sc.action)}
                              className="font-mono text-[11px] rounded px-2 py-0.5 hover:bg-gray-100 cursor-pointer"
                              style={{ color: "var(--text-secondary)" }}>
                              {sc.keys}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={() => toast.success("Reset", "Shortcuts restored to defaults")}
                className="flex items-center gap-1 mt-3 text-[10px] opacity-30 hover:opacity-60">
                <RotateCcw size={10} /> {t("reset_shortcuts")}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t px-5 py-3" style={{ borderColor: "var(--border)" }}>
          <button className="flex items-center gap-1 rounded border px-3 py-1.5 text-xs min-touch"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            <RotateCcw size={11} /> {t("reset_all")}
          </button>
          <div className="flex-1" />
          <button onClick={onClose}
            className="rounded border px-4 py-1.5 text-xs min-touch"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>{t("common:cancel")}</button>
          <button onClick={handleSave}
            className="flex items-center gap-1 rounded-md bg-peach-500 px-5 py-1.5 text-xs font-medium text-white hover:bg-peach-700 min-touch">
            <Save size={12} /> {t("save_preferences")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PreferencesPanel;
