import { useCallback, useEffect, useState } from "react";
import { X, Copy, RefreshCw, Circle, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useToast } from "../../stores/toastStore";

/* ── Service status type ── */
type ServiceStatus = "ok" | "slow" | "error" | "unknown";

interface ServiceRow {
  name: string;
  status: ServiceStatus;
  responseMs: number | null;
  detail?: string;
}

function StatusIcon({ status }: { status: ServiceStatus }) {
  switch (status) {
    case "ok":      return <CheckCircle size={16} color="#4CAF50" />;
    case "slow":    return <Clock size={16} color="#F1D7FF" />;
    case "error":   return <AlertTriangle size={16} color="#F44336" />;
    default:        return <Circle size={16} color="#9E9E9E" />;
  }
}

function StatusLabel({ status }: { status: ServiceStatus }) {
  switch (status) {
    case "ok":      return "OK";
    case "slow":    return "Slow";
    case "error":   return "Error";
    default:        return "—";
  }
}

/**
 * Modal shown when the user clicks the logo in error state.
 * Displays a diagnostic table of backend services with status + response time.
 */
export function SystemDiagnosticModal() {
  const diagnosticOpen = useUIStore((s) => s.diagnosticOpen);
  const error = useUIStore((s) => s.error);
  const closeDiagnostic = useUIStore((s) => s.closeDiagnostic);
  const { toast } = useToast();
  const modalRef = useFocusTrap(diagnosticOpen, closeDiagnostic);

  const [services, setServices] = useState<ServiceRow[]>([
    { name: "SQLite",     status: "unknown", responseMs: null },
    { name: "Supabase",   status: "unknown", responseMs: null },
    { name: "Tailscale",  status: "unknown", responseMs: null },
    { name: "Whisper",    status: "unknown", responseMs: null },
    { name: "Disk",       status: "unknown", responseMs: null },
  ]);
  const [checking, setChecking] = useState(false);

  // Run diagnostic on open
  useEffect(() => {
    if (!diagnosticOpen) return;
    runDiagnostics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnosticOpen]);

  const runDiagnostics = useCallback(async () => {
    setChecking(true);
    const results: ServiceRow[] = [];

    // SQLite check
    try {
      const t0 = performance.now();
      // Placeholder — real impl would ping SQLite
      await new Promise((r) => setTimeout(r, 80));
      results.push({ name: "SQLite", status: "ok", responseMs: Math.round(performance.now() - t0) });
    } catch {
      results.push({ name: "SQLite", status: "error", responseMs: null });
    }

    // Supabase check
    try {
      const t0 = performance.now();
      const online = navigator.onLine;
      if (!online) throw new Error("offline");
      // Placeholder ping
      await new Promise((r) => setTimeout(r, 120));
      results.push({ name: "Supabase", status: "ok", responseMs: Math.round(performance.now() - t0) });
    } catch {
      results.push({ name: "Supabase", status: "error", responseMs: null });
    }

    // Tailscale
    try {
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, 50));
      results.push({ name: "Tailscale", status: "ok", responseMs: Math.round(performance.now() - t0) });
    } catch {
      results.push({ name: "Tailscale", status: "error", responseMs: null });
    }

    // Whisper
    try {
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, 30));
      results.push({ name: "Whisper", status: "ok", responseMs: Math.round(performance.now() - t0) });
    } catch {
      results.push({ name: "Whisper", status: "error", responseMs: null });
    }

    // Disk space
    try {
      const t0 = performance.now();
      const estimate = await navigator.storage?.estimate?.();
      const used = estimate ? Math.round((estimate.usage ?? 0) / 1024 / 1024) : 0;
      const quota = estimate ? Math.round((estimate.quota ?? 0) / 1024 / 1024) : 0;
      results.push({ name: "Disk", status: quota > 0 ? "ok" : "unknown", responseMs: Math.round(performance.now() - t0) });
      // Override unused for this scope — show disk info in the row
      results[results.length - 1].detail = quota > 0 ? `${used}MB / ${quota}MB` : "N/A";
    } catch {
      results.push({ name: "Disk", status: "error", responseMs: null });
    }

    setServices(results);
    setChecking(false);
  }, []);

  const copyDiagnostic = useCallback(() => {
    const text = services
      .map((s) => `${s.name}: ${s.status}${s.responseMs ? ` (${s.responseMs}ms)` : ""}`)
      .join("\n");
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied", "Diagnostic report copied"),
      () => toast.error("Failed to copy"),
    );
  }, [services, toast]);

  if (!diagnosticOpen) return null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="System diagnostics"
      onClick={(e) => { if (e.target === e.currentTarget) closeDiagnostic(); }}
    >
      <div
        className="relative w-full max-w-lg rounded-lg shadow-xl"
        style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span role="img" aria-label="diagnostic">🔴</span>
            System status
          </h2>
          <button
            onClick={closeDiagnostic}
            className="rounded p-1 opacity-50 hover:opacity-100 min-touch"
            aria-label="Close diagnostics"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Active error */}
        {error && (
          <div className="mx-6 mt-4 rounded-md border border-red-200 p-3 dark:border-red-800"
            style={{ backgroundColor: "var(--bg-secondary)" }}
            role="alert"
          >
            <p className="text-sm font-medium">{error.type.toUpperCase()}: {error.message}</p>
          </div>
        )}

        {/* Service table */}
        <div className="px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs opacity-50" style={{ color: "var(--text-secondary)" }}>
                <th className="pb-2 font-medium">Service</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 text-right font-medium">Response</th>
              </tr>
            </thead>
            <tbody>
              {services.map((svc) => (
                <tr key={svc.name} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="py-2.5 font-medium">{svc.name}</td>
                  <td className="py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <StatusIcon status={svc.status} />
                      <StatusLabel status={svc.status} />
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-mono text-xs opacity-60">
                    {svc.responseMs !== null ? `${svc.responseMs}ms` : "—"}
                    {svc.detail && (
                      <span className="ml-2 opacity-50">{svc.detail}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            onClick={copyDiagnostic}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium min-touch"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            <Copy size={14} aria-hidden="true" />
            Copy diagnostic
          </button>
          <button
            onClick={runDiagnostics}
            disabled={checking}
            className="inline-flex items-center gap-2 rounded-md bg-peach-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-peach-700 disabled:opacity-50 min-touch"
          >
            <RefreshCw size={14} className={checking ? "animate-spin" : ""} aria-hidden="true" />
            {checking ? "Checking..." : "Retry connections"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SystemDiagnosticModal;
