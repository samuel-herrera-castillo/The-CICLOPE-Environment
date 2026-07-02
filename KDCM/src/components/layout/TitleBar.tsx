import { useEffect, useState, useCallback, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Minus, Copy, Square, X } from "lucide-react";
import { KdcmLogo } from "../common/KdcmLogo";
import { useUIStore } from "../../stores/uiStore";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { isTauri } from "../../utils/env";

/**
 * Tauri custom title bar (36px tall, peach-700 background).
 * Only rendered in Tauri — hidden in web/browser mode.
 *
 * Zones (left → right):
 * - Left:     KDCM logo + project name
 * - Center:   data-tauri-drag-region (drag-to-move window), cursor: move
 * - Right:    132px wide, 3 window control buttons (44×36px each):
 *             [Minimize] [Maximize/Restore] [Close]
 */
export function TitleBar() {
  // ── ALL hooks must be called unconditionally (React rules) ──
  const { t } = useTranslation("collab");
  const collaborativeSession = useUIStore((s) => s.collaborativeSession);
  const [maximized, setMaximized] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Maximize state tracking (always registered, but no-op in web)
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;

    import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => {
        const appWindow = getCurrentWindow();
        appWindow.isMaximized().then(setMaximized);
        appWindow.onResized(() => {
          appWindow.isMaximized().then(setMaximized);
        }).then((fn) => { unlisten = fn; });
      })
      .catch(console.error);

    return () => { unlisten?.(); };
  }, []);

  // Window actions
  const handleMinimize = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch (e) { console.error("Minimize failed:", e); }
  }, []);

  const handleToggleMaximize = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().toggleMaximize();
    } catch (e) { console.error("Toggle maximize failed:", e); }
  }, []);

  const handleClose = useCallback(async () => {
    if (!isTauri()) return;
    if (collaborativeSession) {
      setShowCloseConfirm(true);
      return;
    }
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch (e) { console.error("Close failed:", e); }
  }, [collaborativeSession]);

  const confirmClose = useCallback(async () => {
    setShowCloseConfirm(false);
    if (!isTauri()) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch (e) { console.error("Close failed:", e); }
  }, []);

  const cancelClose = useCallback(() => {
    setShowCloseConfirm(false);
  }, []);

  // Focus trap for close-confirmation modal
  const closeModalRef = useFocusTrap(showCloseConfirm, cancelClose);

  // ── In web mode, render nothing ──
  if (!isTauri()) return null;

  return (
    <>
      {/* ── Title bar ── */}
      <div
        className="flex h-[36px] w-full select-none items-center bg-peach-700 text-white no-print"
        onMouseDown={(e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (target.closest("[data-no-drag]")) e.preventDefault();
        }}
      >
        <div className="flex items-center gap-2 pl-3">
          <KdcmLogo size={20} variant="color" />
          <span className="text-sm font-medium tracking-wide">KDCM</span>
        </div>
        <div data-tauri-drag-region className="flex-1 h-full cursor-move" />
        <div data-no-drag className="flex h-full items-center" style={{ width: 132 }}>
          <button onClick={handleMinimize} className="flex h-full w-[44px] items-center justify-center transition-colors hover:bg-white/15" aria-label={t("minimize")}>
            <Minus size={14} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <button onClick={handleToggleMaximize} className="flex h-full w-[44px] items-center justify-center transition-colors hover:bg-white/15" aria-label={maximized ? "Restore" : "Maximize"}>
            {maximized ? <Copy size={12} strokeWidth={2.5} aria-hidden="true" /> : <Square size={12} strokeWidth={2.5} aria-hidden="true" />}
          </button>
          <button onClick={handleClose} className="flex h-full w-[44px] items-center justify-center transition-colors hover:bg-[#C42B1C]" aria-label={t("common:close")}>
            <X size={14} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── Close confirmation modal ── */}
      {showCloseConfirm && (
        <div ref={closeModalRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) cancelClose(); }}>
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl dark:bg-gray-800" role="dialog" aria-modal="true" aria-labelledby="close-confirm-title">
            <h3 id="close-confirm-title" className="mb-2 text-base font-semibold text-gray-900 dark:text-white">{t("session_active")}</h3>
            <p className="mb-5 text-sm text-gray-600 dark:text-gray-300">{t("end_session_confirm", {count: 1})}</p>
            <div className="flex justify-end gap-3">
              <button onClick={cancelClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 min-touch">{t("common:cancel")}</button>
              <button onClick={confirmClose} className="rounded-md bg-[#C42B1C] px-4 py-2 text-sm font-medium text-white hover:bg-[#A82018] transition-colors min-touch">{t("end_session")}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TitleBar;
