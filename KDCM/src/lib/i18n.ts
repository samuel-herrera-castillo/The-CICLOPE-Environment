import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// ── Spanish ──
import es_common from '../locales/es/common.json';
import es_nav from '../locales/es/nav.json';
import es_docs from '../locales/es/docs.json';
import es_codes from '../locales/es/codes.json';
import es_analysis from '../locales/es/analysis.json';
import es_viz from '../locales/es/viz.json';
import es_maps from '../locales/es/maps.json';
import es_collab from '../locales/es/collab.json';
import es_settings from '../locales/es/settings.json';
import es_errors from '../locales/es/errors.json';
import es_empty from '../locales/es/empty.json';
import es_export from '../locales/es/export.json';

// ── English ──
import en_common from '../locales/en/common.json';
import en_nav from '../locales/en/nav.json';
import en_docs from '../locales/en/docs.json';
import en_codes from '../locales/en/codes.json';
import en_analysis from '../locales/en/analysis.json';
import en_viz from '../locales/en/viz.json';
import en_maps from '../locales/en/maps.json';
import en_collab from '../locales/en/collab.json';
import en_settings from '../locales/en/settings.json';
import en_errors from '../locales/en/errors.json';
import en_empty from '../locales/en/empty.json';
import en_export from '../locales/en/export.json';

// ── French ──
import fr_common from '../locales/fr/common.json';
import fr_nav from '../locales/fr/nav.json';
import fr_docs from '../locales/fr/docs.json';
import fr_codes from '../locales/fr/codes.json';
import fr_analysis from '../locales/fr/analysis.json';
import fr_viz from '../locales/fr/viz.json';
import fr_maps from '../locales/fr/maps.json';
import fr_collab from '../locales/fr/collab.json';
import fr_settings from '../locales/fr/settings.json';
import fr_errors from '../locales/fr/errors.json';
import fr_empty from '../locales/fr/empty.json';
import fr_export from '../locales/fr/export.json';

// ── Portuguese ──
import pt_common from '../locales/pt/common.json';
import pt_nav from '../locales/pt/nav.json';
import pt_docs from '../locales/pt/docs.json';
import pt_codes from '../locales/pt/codes.json';
import pt_analysis from '../locales/pt/analysis.json';
import pt_viz from '../locales/pt/viz.json';
import pt_maps from '../locales/pt/maps.json';
import pt_collab from '../locales/pt/collab.json';
import pt_settings from '../locales/pt/settings.json';
import pt_errors from '../locales/pt/errors.json';
import pt_empty from '../locales/pt/empty.json';
import pt_export from '../locales/pt/export.json';

const SUPPORTED_LANGS = ['es', 'en', 'fr', 'pt'];

function detectLang(): string {
  try {
    const saved = localStorage.getItem('kdcm-lang');
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  } catch { /* noop */ }

  try {
    const browserLang = navigator.language.split('-')[0];
    if (SUPPORTED_LANGS.includes(browserLang)) return browserLang;
  } catch { /* noop */ }

  return 'es';
}

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: detectLang(),
    fallbackLng: 'es',
    defaultNS: 'common',
    ns: [
      'common', 'nav', 'docs', 'codes', 'analysis',
      'viz', 'maps', 'collab', 'settings', 'errors',
      'empty', 'export',
    ],
    resources: {
      es: {
        common: es_common,
        nav: es_nav,
        docs: es_docs,
        codes: es_codes,
        analysis: es_analysis,
        viz: es_viz,
        maps: es_maps,
        collab: es_collab,
        settings: es_settings,
        errors: es_errors,
        empty: es_empty,
        export: es_export,
      },
      en: {
        common: en_common,
        nav: en_nav,
        docs: en_docs,
        codes: en_codes,
        analysis: en_analysis,
        viz: en_viz,
        maps: en_maps,
        collab: en_collab,
        settings: en_settings,
        errors: en_errors,
        empty: en_empty,
        export: en_export,
      },
      fr: {
        common: fr_common,
        nav: fr_nav,
        docs: fr_docs,
        codes: fr_codes,
        analysis: fr_analysis,
        viz: fr_viz,
        maps: fr_maps,
        collab: fr_collab,
        settings: fr_settings,
        errors: fr_errors,
        empty: fr_empty,
        export: fr_export,
      },
      pt: {
        common: pt_common,
        nav: pt_nav,
        docs: pt_docs,
        codes: pt_codes,
        analysis: pt_analysis,
        viz: pt_viz,
        maps: pt_maps,
        collab: pt_collab,
        settings: pt_settings,
        errors: pt_errors,
        empty: pt_empty,
        export: pt_export,
      },
    },
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'kdcm-lang',
      caches: ['localStorage'],
    },
  });

/** Persist language preference */
i18next.on('languageChanged', (lng) => {
  try { localStorage.setItem('kdcm-lang', lng); } catch { /* noop */ }
});

export default i18next;
