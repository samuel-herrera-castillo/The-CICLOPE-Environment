import { useCallback } from "react";
import { AlertTriangle, RefreshCw, Copy, Download } from "lucide-react";
import { useToast } from "../../stores/toastStore";

interface PanelErrorProps {
  panel: string;
  error: Error;
  onRetry: () => void;
}

/**
 * Crash screen shown inside a single panel when its ErrorBoundary catches.
 *
 * Features:
 * - ⚠ 48px orange warning icon
 * - Error message + panel name
 * - [Retry] [Copy error] [Export data] buttons
 *
 * The rest of the app remains functional.
 */
export function PanelError({ panel, error, onRetry }: PanelErrorProps) {
  const { toast } = useToast();

  const copyError = useCallback(() => {
    const text = `Panel: ${panel}\nError: ${error.message}\nStack: ${error.stack ?? "N/A"}`;
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied", "Error details copied to clipboard"),
      () => toast.error("Failed to copy"),
    );
  }, [panel, error, toast]);

  const exportData = useCallback(() => {
    // Trigger download of a JSON blob with state/debug info
    const payload = {
      panel,
      error: { message: error.message, stack: error.stack },
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kdcm-crash-${panel}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported", "Crash report downloaded");
  }, [panel, error, toast]);

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-4 px-6 py-12 text-center"
      role="alert"
    >
      {/* Icon */}
      <AlertTriangle size={48} color="#F1D7FF" aria-hidden="true" />

      {/* Message */}
      <div>
        <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
          Something went wrong in this panel
        </p>
        <p className="mt-1 text-sm opacity-50" style={{ color: "var(--text-secondary)" }}>
          {panel} — {error.message}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-md bg-peach-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-peach-700 min-touch"
        >
          <RefreshCw size={14} aria-hidden="true" />
          Retry
        </button>
        <button
          onClick={copyError}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50 min-touch"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          <Copy size={14} aria-hidden="true" />
          Copy error
        </button>
        <button
          onClick={exportData}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-50 min-touch"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          <Download size={14} aria-hidden="true" />
          Export data
        </button>
      </div>
    </div>
  );
}

export default PanelError;
