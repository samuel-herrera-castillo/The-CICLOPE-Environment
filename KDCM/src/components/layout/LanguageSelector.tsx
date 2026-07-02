import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useToast } from "../../stores/toastStore";
import i18next from "../../lib/i18n";

interface LangOption {
  code: string;
  flag: string;
  nativeName: string;
  label: string;
}

const LANGS: LangOption[] = [
  { code: "es", flag: "🇪🇸", nativeName: "Español", label: "ES" },
  { code: "en", flag: "🇺🇸", nativeName: "English", label: "EN" },
  { code: "fr", flag: "🇫🇷", nativeName: "Français", label: "FR" },
  { code: "pt", flag: "🇧🇷", nativeName: "Português", label: "PT" },
];

const LANG_NAMES: Record<string, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
  pt: "Português",
};

interface LanguageSelectorProps {
  position?: "navbar" | "standalone";
}

export function LanguageSelector({ position = "navbar" }: LanguageSelectorProps) {
  const { t, i18n } = useTranslation("common");
  const project = useProjectStore((s) => s.project);
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLang = i18n.language?.split("-")[0] || "es";
  const current = LANGS.find((l) => l.code === currentLang) || LANGS[0];

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const changeLanguage = useCallback(
    async (code: string) => {
      if (code === currentLang) {
        setOpen(false);
        return;
      }

      // 1. Change i18next language (instant re-render)
      await i18next.changeLanguage(code);

      // 2. Persist to localStorage (always)
      try {
        localStorage.setItem("kdcm-lang", code);
      } catch { /* noop */ }

      // 3. Persist to SQLite if project is open (via tauriBridge wrapper)
      if (project?.id) {
        try {
          const { updateInvestigadorLang } = await import("../../lib/tauriBridge");
          // Use researcher name as fallback ID for web mode
          const investigadorId = project.researcherName || "researcher";
          await updateInvestigadorLang(investigadorId, code);
        } catch { /* Tauri not available, fallback to localStorage */ }
      }

      setOpen(false);

      // 4. Toast in the new language
      const langName = LANG_NAMES[code] || code;
      setTimeout(() => {
        toast.success("🌐", t("language_changed", { lang: langName }));
      }, 50);
    },
    [currentLang, project, t, toast]
  );

  // Navbar version: compact button + dropdown
  if (position === "navbar") {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-[36px] items-center gap-1 rounded-md px-1.5 text-sm font-medium transition-all duration-150 min-touch"
          style={{
            background: open ? "rgba(255,255,255,0.15)" : "transparent",
            color: "#000",
          }}
          aria-label={`Language: ${current.nativeName}`}
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span className="text-sm leading-none" style={{ width: 16, height: 12, display: "inline-flex", alignItems: "center" }}>
            {current.flag}
          </span>
          <span>{current.label}</span>
          <ChevronDown
            size={10}
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div
            className="absolute right-0 top-full z-50 mt-1 w-[220px] rounded-lg border py-1 shadow-xl"
            style={{
              backgroundColor: "var(--bg-panel)",
              borderColor: "var(--border)",
            }}
            role="listbox"
            aria-label="Select language"
          >
            {LANGS.map((lang) => {
              const isActive = lang.code === currentLang;
              return (
                <button
                  key={lang.code}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => changeLanguage(lang.code)}
                  className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-left text-sm transition-colors min-touch"
                  style={{
                    backgroundColor: isActive ? "var(--bg-secondary)" : "transparent",
                    fontWeight: isActive ? 600 : 400,
                    color: "#000",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.target as HTMLElement).style.backgroundColor = "var(--bg-secondary)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.target as HTMLElement).style.backgroundColor = "transparent";
                  }}
                >
                  <span style={{ fontSize: 20, width: 20, height: 15, display: "inline-flex", alignItems: "center" }}>
                    {lang.flag}
                  </span>
                  <span className="flex-1">{lang.nativeName}</span>
                  {isActive && (
                    <span style={{ color: "var(--peach, #9b59b6)", fontWeight: 600 }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Standalone version: slightly larger for Welcome screen
  return (
    <div ref={ref} className="relative" style={{ position: "absolute", top: 16, right: 16 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-150 min-touch hover:bg-gray-50"
        style={{
          borderColor: "var(--border)",
          color: "#000",
        }}
        aria-label={`Language: ${current.nativeName}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span style={{ fontSize: 18 }}>{current.flag}</span>
        <span>{current.label}</span>
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-[220px] rounded-lg border py-1 shadow-xl"
          style={{
            backgroundColor: "var(--bg-panel)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
          role="listbox"
          aria-label="Select language"
        >
          {LANGS.map((lang) => {
            const isActive = lang.code === currentLang;
            return (
              <button
                key={lang.code}
                role="option"
                aria-selected={isActive}
                onClick={() => changeLanguage(lang.code)}
                className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-left text-sm transition-colors min-touch"
                style={{
                  backgroundColor: isActive ? "var(--bg-secondary)" : "transparent",
                  fontWeight: isActive ? 600 : 400,
                  color: "#000",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.target as HTMLElement).style.backgroundColor = "var(--bg-secondary)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.target as HTMLElement).style.backgroundColor = "transparent";
                }}
              >
                <span style={{ fontSize: 20 }}>{lang.flag}</span>
                <span className="flex-1">{lang.nativeName}</span>
                {isActive && (
                  <span style={{ color: "var(--peach, #9b59b6)", fontWeight: 600 }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageSelector;
