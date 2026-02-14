import { ReactNode, useMemo, useState } from 'react';

import { loadAnonymousPreferences, saveAnonymousPreferences } from '../preferences';
import { I18nContext, I18nContextValue } from './context';
import { Locale, messages } from './messages';

const detectInitialLocale = (): Locale => {
  const storedLocale = loadAnonymousPreferences().locale;
  if (storedLocale) {
    return storedLocale;
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
    saveAnonymousPreferences({ locale: nextLocale });
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
