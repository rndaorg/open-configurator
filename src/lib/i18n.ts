import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from '@/locales/en.json';
import es from '@/locales/es.json';
import ar from '@/locales/ar.json';
import fr from '@/locales/fr.json';
import de from '@/locales/de.json';

export const languages = [
  { code: 'en', name: 'English', dir: 'ltr', currency: 'USD', locale: 'en-US' },
  { code: 'es', name: 'Español', dir: 'ltr', currency: 'EUR', locale: 'es-ES' },
  { code: 'fr', name: 'Français', dir: 'ltr', currency: 'EUR', locale: 'fr-FR' },
  { code: 'de', name: 'Deutsch', dir: 'ltr', currency: 'EUR', locale: 'de-DE' },
  { code: 'ar', name: 'العربية', dir: 'rtl', currency: 'SAR', locale: 'ar-SA' },
] as const;

export type LanguageCode = typeof languages[number]['code'];

export const rtlLanguages: readonly string[] = languages.filter(l => l.dir === 'rtl').map(l => l.code);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      ar: { translation: ar },
      fr: { translation: fr },
      de: { translation: de },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
