import { RouteLoadingScreen } from '@synqit/ui';
import { ReactNode, startTransition, useEffect, useMemo, useState } from 'react';

import { I18nContext, I18nContextValue } from './context';
import { loadLocaleMessages, Locale, type MessageDictionary } from './messages';
import { isAuthenticated } from '../auth';
import { loadAnonymousPreferences, saveAnonymousPreferences } from '../preferences';
import { updateUserPreferences } from '../queries';

// The marketing site (different subdomain → separate localStorage) forwards the
// visitor's chosen locale via a `?lang=` query param so the app stays consistent
// with the site. A param wins over stored prefs here because it reflects the
// choice the visitor just made on the site before landing on login/create.
const readLocaleFromUrl = (): Locale | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const param = new URLSearchParams(window.location.search).get('lang');
  return param === 'en' || param === 'fr' ? param : null;
};

const detectInitialLocale = (): Locale => {
  const urlLocale = readLocaleFromUrl();
  if (urlLocale) {
    saveAnonymousPreferences({ locale: urlLocale });
    return urlLocale;
  }

  const storedLocale = loadAnonymousPreferences().locale;
  if (storedLocale) {
    return storedLocale;
  }

  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('fr')) {
    return 'fr';
  }

  return 'en';
};

const shouldBypassBootLoader = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const { pathname } = window.location;
  return pathname.startsWith('/playlist/') || pathname.startsWith('/event/');
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

const resolvePluralPath = (
  messages: MessageDictionary | null,
  key: string,
  vars?: Record<string, string | number>,
): string | null => {
  if (!messages || typeof vars?.count !== 'number') {
    return null;
  }

  const pluralKey = vars.count === 1 ? `${key}_one` : `${key}_other`;
  return resolvePath(messages, pluralKey);
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
        if (isAuthenticated()) {
          void updateUserPreferences({ locale: nextLocale }).catch(() => undefined);
        }
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
      const localized =
        (activeMessages ? resolvePath(activeMessages, key) : null) ??
        resolvePluralPath(activeMessages, key, vars);
      if (localized) {
        return interpolate(localized, vars);
      }

      const fallback =
        (fallbackMessages ? resolvePath(fallbackMessages, key) : null) ??
        resolvePluralPath(fallbackMessages, key, vars);
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

  if (!activeMessages && !fallbackMessages && !shouldBypassBootLoader()) {
    return <RouteLoadingScreen />;
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
