import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

import en from '../../../web/src/locales/en/common.json';
import fr from '../../../web/src/locales/fr/common.json';

const LOCALE_STORAGE_KEY = 'synqit.site.locale.v1';

const messages = {
  en,
  fr,
} as const;

type Locale = keyof typeof messages;

type I18nContextValue = {
  locale: Locale;
  setLocale: (nextLocale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const detectInitialLocale = (): Locale => {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored === 'en' || stored === 'fr') {
        return stored;
      }
    } catch {
      // Ignore storage access failures.
    }
  }

  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('fr')) {
    return 'fr';
  }

  return 'en';
};

const resolvePath = (obj: unknown, path: string): string | null => {
  if (!obj || typeof obj !== 'object') {
    return null;
  }

  const value = path.split('.').reduce<unknown>((current, nextKey) => {
    if (!current || typeof current !== 'object') {
      return null;
    }

    return (current as Record<string, unknown>)[nextKey];
  }, obj);

  return typeof value === 'string' ? value : null;
};

const interpolate = (template: string, vars?: Record<string, string | number>): string => {
  if (!vars) {
    return template;
  }

  return Object.entries(vars).reduce((result, [key, value]) => {
    return result.replaceAll(`{{${key}}}`, String(value));
  }, template);
};

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(() => detectInitialLocale());

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
      } catch {
        // Ignore storage access failures.
      }
    }
  };

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: string, vars?: Record<string, string | number>): string => {
      const localized = resolvePath(messages[locale], key);
      if (localized) {
        return interpolate(localized, vars);
      }

      const fallback = resolvePath(messages.en, key);
      if (fallback) {
        return interpolate(fallback, vars);
      }

      return key;
    };

    return {
      locale,
      setLocale,
      t,
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }

  return context;
};
