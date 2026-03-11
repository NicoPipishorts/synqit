import { ReactNode, startTransition, useEffect, useMemo, useState } from 'react';

import { I18nContext, I18nContextValue } from './context';
import { loadLocaleMessages, Locale, type MessageDictionary } from './messages';
import { RouteLoadingScreen } from '../../components/ui/RouteLoadingScreen';
import { loadAnonymousPreferences, saveAnonymousPreferences } from '../preferences';

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
  const [activeMessages, setActiveMessages] = useState<MessageDictionary | null>(null);
  const [fallbackMessages, setFallbackMessages] = useState<MessageDictionary | null>(null);

  const setLocale = (nextLocale: Locale) => {
    void loadLocaleMessages(nextLocale)
      .then((nextMessages) => {
        startTransition(() => {
          setActiveMessages(nextMessages);
          setLocaleState(nextLocale);
        });
        saveAnonymousPreferences({ locale: nextLocale });
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    let isCancelled = false;

    void loadLocaleMessages('en')
      .then((englishMessages) => {
        if (!isCancelled) {
          setFallbackMessages(englishMessages);
        }
      })
      .catch(() => undefined);

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    void loadLocaleMessages(locale)
      .then((localizedMessages) => {
        if (!isCancelled) {
          setActiveMessages(localizedMessages);
        }
      })
      .catch(async () => {
        if (locale === 'en') {
          return;
        }
        const englishMessages = await loadLocaleMessages('en').catch(() => null);
        if (!isCancelled && englishMessages) {
          setActiveMessages(englishMessages);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: string, vars?: Record<string, string | number>): string => {
      const localized = activeMessages ? resolvePath(activeMessages, key) : null;
      if (localized) {
        return interpolate(localized, vars);
      }

      const fallback = fallbackMessages ? resolvePath(fallbackMessages, key) : null;
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
  }, [activeMessages, fallbackMessages, locale]);

  if (!activeMessages && !fallbackMessages) {
    return <RouteLoadingScreen />;
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
