import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../stores/projectStore";
import { useOnboardingStore } from "../stores/onboardingStore";
import { KdcmLogo } from "../components/common/KdcmLogo";
import { LanguageSelector } from "../components/layout/LanguageSelector";

/**
 * Welcome / project creation page.
 *
 * Shown when no project is open. Allows the user to:
 * - Create a new project (triggers onboarding if first time)
 * - Open an existing project (from SQLite or Supabase)
 */
export function Welcome() {
  const { t } = useTranslation("common");
  const createProject = useProjectStore((s) => s.createProject);
  const openProject = useProjectStore((s) => s.openProject);
  const onboardingDone = useOnboardingStore((s) => s.onboardingDone);
  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);

  const [name, setName] = useState("");
  const [researcherName, setResearcherName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createProject(name.trim(), researcherName.trim() || t("researcher"));
  };

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-8 px-8 py-16 text-center" style={{ position: "relative" }}>
      {/* Language selector — top right */}
      <LanguageSelector position="standalone" />

      {/* Logo + tagline */}
      <KdcmLogo size={80} variant="color" />
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
          KDCM
        </h1>
        <p className="mt-1 text-sm opacity-50" style={{ color: "var(--text-secondary)" }}>
          {t("tagline")}
        </p>
      </div>

      {showCreate ? (
        /* ── Create project form ── */
        <form onSubmit={handleCreate} className="w-full max-w-xs space-y-4">
          <div>
            <label className="mb-1 block text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              {t("project_name")}
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("my_research_project")}
              className="w-full rounded-md border px-4 py-2.5 text-sm outline-none transition"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-left text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              {t("researcher_name")}
            </label>
            <input
              type="text"
              value={researcherName}
              onChange={(e) => setResearcherName(e.target.value)}
              placeholder={t("your_name")}
              className="w-full rounded-md border px-4 py-2.5 text-sm outline-none transition"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full rounded-md bg-peach-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-peach-700 disabled:opacity-40 min-touch"
          >
            {t("create_project")}
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(false)}
            className="w-full text-sm font-medium underline opacity-50 hover:opacity-80"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("cancel")}
          </button>
        </form>
      ) : (
        /* ── Actions ── */
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-peach-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-peach-700 min-touch"
          >
            {t("new_project")}
          </button>
          <button
            onClick={() => openProject("")}
            className="rounded-md border px-6 py-2.5 text-sm font-medium transition-colors hover:bg-gray-50 min-touch"
            style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
          >
            {t("open_project")}
          </button>

          {/* Dev: reset onboarding */}
          {onboardingDone && (
            <button
              onClick={resetOnboarding}
              className="mt-4 text-xs underline opacity-30 hover:opacity-60"
              style={{ color: "var(--text-secondary)" }}
            >
              Reset onboarding (dev)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default Welcome;
