import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/* ── Variant definitions ── */
type EmptyVariant = "no-documents" | "no-codes" | "no-results" | "no-visualization" | "no-selection";

interface EmptyStateProps {
  variant: EmptyVariant;
  title?: string;
  subtitle?: string;
  /** Optional action button */
  action?: ReactNode;
}

/**
 * Empty state placeholder — illustration + title + subtitle + optional CTA.
 *
 * Uses i18next for translations.
 *
 * Usage:
 *   <EmptyState variant="no-documents" action={<button>+ Nuevo</button>} />
 */
export function EmptyState({ variant, title, subtitle, action }: EmptyStateProps) {
  const { t } = useTranslation("empty");

  // Map variant to translation paths
  const variantKeys: Record<EmptyVariant, { titleKey: string; subtitleKey: string }> = {
    "no-documents":     { titleKey: "no_documents.title",     subtitleKey: "no_documents.subtitle" },
    "no-codes":         { titleKey: "no_codes.title",         subtitleKey: "no_codes.subtitle" },
    "no-results":       { titleKey: "no_results.title",       subtitleKey: "no_results.subtitle" },
    "no-visualization": { titleKey: "no_visualization.title", subtitleKey: "no_visualization.subtitle" },
    "no-selection":     { titleKey: "no_selection.title",     subtitleKey: "no_selection.subtitle" },
  };

  const keys = variantKeys[variant];

  // SVG illustrations per variant
  const illustrations: Record<EmptyVariant, ReactNode> = {
    "no-documents": (
      <svg width="80" height="72" viewBox="0 0 80 72" fill="none" aria-hidden="true">
        <path d="M8 20h20l6 8h34c3 0 6 2.5 6 5.5v26c0 3-3 5.5-6 5.5H8c-3 0-6-2.5-6-5.5v-34c0-3 3-5.5 6-5.5z"
          fill="#F1D7FF" fillOpacity="0.35" stroke="#F1D7FF" strokeWidth="1.5" strokeLinejoin="round"/>
        <line x1="20" y1="42" x2="55" y2="42" stroke="#F1D7FF" strokeWidth="1.8" strokeLinecap="round" opacity="0.5"/>
        <line x1="20" y1="50" x2="42" y2="50" stroke="#F1D7FF" strokeWidth="1.8" strokeLinecap="round" opacity="0.3"/>
        <circle cx="64" cy="56" r="14" fill="#FAFAFA" stroke="#F1D7FF" strokeWidth="1.2"/>
        <text x="64" y="60" textAnchor="middle" fill="#F1D7FF" fontSize="14" fontWeight="600" fontFamily="Inter, sans-serif">+</text>
      </svg>
    ),
    "no-codes": (
      <svg width="160" height="120" viewBox="0 0 160 120" fill="none" aria-hidden="true">
        <path d="M100 20H55l-40 40 40 40h45c6 0 11-4.5 11-10V30c0-5.5-5-10-11-10z"
          fill="#F5F5F5" stroke="#BDBDBD" strokeWidth="2"/>
        <circle cx="70" cy="60" r="5" fill="#BDBDBD" opacity="0.4"/>
        <line x1="85" y1="58" x2="125" y2="58" stroke="#BDBDBD" strokeWidth="2" strokeDasharray="4 3" opacity="0.5"/>
      </svg>
    ),
    "no-results": (
      <svg width="160" height="120" viewBox="0 0 160 120" fill="none" aria-hidden="true">
        <circle cx="65" cy="62" r="30" stroke="#BDBDBD" strokeWidth="6"/>
        <line x1="86" y1="83" x2="115" y2="112" stroke="#BDBDBD" strokeWidth="6" strokeLinecap="round"/>
        <line x1="52" y1="50" x2="78" y2="74" stroke="#F44336" strokeWidth="3" strokeLinecap="round"/>
        <line x1="78" y1="50" x2="52" y2="74" stroke="#F44336" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    ),
    "no-visualization": (
      <svg width="160" height="120" viewBox="0 0 160 120" fill="none" aria-hidden="true">
        <line x1="30" y1="10" x2="30" y2="105" stroke="#BDBDBD" strokeWidth="2"/>
        <line x1="28" y1="103" x2="150" y2="103" stroke="#BDBDBD" strokeWidth="2"/>
        <rect x="42" y="40" width="16" height="63" stroke="#E0E0E0" strokeWidth="1.5" strokeDasharray="4 3" fill="none"/>
        <rect x="70" y="55" width="16" height="48" stroke="#E0E0E0" strokeWidth="1.5" strokeDasharray="4 3" fill="none"/>
        <rect x="98" y="25" width="16" height="78" stroke="#E0E0E0" strokeWidth="1.5" strokeDasharray="4 3" fill="none"/>
        <rect x="126" y="50" width="16" height="53" stroke="#E0E0E0" strokeWidth="1.5" strokeDasharray="4 3" fill="none"/>
      </svg>
    ),
    "no-selection": (
      <svg width="160" height="120" viewBox="0 0 160 120" fill="none" aria-hidden="true">
        <path d="M45 25l4 12 10-3 8 18 6-3-9-19 10 2-14-14z"
          fill="#757575"/>
        <rect x="65" y="48" width="70" height="50" rx="4"
          stroke="#BDBDBD" strokeWidth="1.5" strokeDasharray="5 4" fill="none"/>
      </svg>
    ),
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center" role="status">
      {/* Illustration */}
      <div className="mb-4 opacity-70">
        {illustrations[variant]}
      </div>

      {/* Title — use prop override or i18n translation */}
      <p className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
        {title ?? t(keys.titleKey)}
      </p>

      {/* Subtitle — use prop override or i18n translation */}
      {(subtitle || keys.subtitleKey) && (
        <p className="mt-1 max-w-xs text-sm" style={{ color: "var(--text-secondary)" }}>
          {subtitle ?? t(keys.subtitleKey)}
        </p>
      )}

      {/* Action */}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export { type EmptyVariant };
export default EmptyState;
