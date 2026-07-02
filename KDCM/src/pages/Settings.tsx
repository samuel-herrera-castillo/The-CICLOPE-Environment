import { useTheme } from "../hooks/useTheme";
import { useLayoutStore, type PestañaIzq } from "../stores/layoutStore";

/**
 * Settings page — accessible from the nav bar.
 *
 * Sections: Theme, Language, Data, About.
 */
export function Settings() {
  const { theme, setTheme } = useTheme();
  const pestañaIzq = useLayoutStore((s) => s.pestañaActivaIzq);
  const setPestañaIzq = useLayoutStore((s) => s.setPestañaActivaIzq);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-6 py-8">
      <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
        Settings
      </h1>

      {/* Theme */}
      <section>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
          Theme
        </h2>
        <div className="flex items-center gap-3">
          {(["system", "light", "dark"] as const).map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm min-touch"
              style={{ borderColor: theme === t ? "var(--peach)" : "var(--border)" }}>
              <input
                type="radio"
                name="settings-theme"
                value={t}
                checked={theme === t}
                onChange={() => setTheme(t)}
                style={{ accentColor: "var(--peach)" }}
              />
              <span style={{ color: "var(--text-primary)" }} className="capitalize">
                {t === "system" ? "System" : t}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Default left panel tab */}
      <section>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
          Default sidebar tab
        </h2>
        <select
          value={pestañaIzq}
          onChange={(e) => setPestañaIzq(e.target.value as PestañaIzq)}
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
        >
          <option value="docs">Documents</option>
          <option value="codes">Codes</option>
          <option value="memos">Memos</option>
          <option value="variables">Variables</option>
        </select>
      </section>

      {/* Language */}
      <section>
        <h2 className="mb-3 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
          Language
        </h2>
        <div className="flex gap-3">
          {[
            { code: "es", label: "Español" },
            { code: "en", label: "English" },
            { code: "fr", label: "Français" },
            { code: "pt", label: "Português" },
          ].map(({ code, label }) => (
            <button
              key={code}
              className="rounded-md border px-4 py-2 text-sm font-medium min-touch"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              onClick={() => {
                import("i18next").then(({ default: i18n }) => i18n.changeLanguage(code));
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Settings;
