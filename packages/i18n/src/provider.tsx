import { type ReactNode, startTransition, useEffect, useMemo, useRef, useState } from 'react';

import { I18nContext, type I18nContextValue } from './context';
import { type MessageDictionary, type MessageVars, translate } from './messages';

export type I18nProviderProps<L extends string> = {
  /** Locale to start with; detection (storage, URL, browser) is the app's job. */
  initialLocale: L;
  /** Locale used when a key is missing in the active dictionary. */
  fallbackLocale: L;
  /** Returns the dictionary for a locale, synchronously or lazily (code-split JSON). */
  loadMessages: (locale: L) => MessageDictionary | Promise<MessageDictionary>;
  /** Called after a user-initiated locale change so the app can persist it. */
  onLocaleChange?: (locale: L) => void;
  /** Rendered until the first dictionary resolves when `loadMessages` is async. */
  loadingFallback?: ReactNode;
  children: ReactNode;
};

const isPromise = <T,>(value: T | Promise<T>): value is Promise<T> =>
  typeof (value as Promise<T>)?.then === 'function';

/**
 * Locale state, dictionary loading with fallback, and `t` for the tree below.
 * Dictionaries are cached per locale for the provider's lifetime.
 */
export const I18nProvider = <L extends string>({
  initialLocale,
  fallbackLocale,
  loadMessages,
  onLocaleChange,
  loadingFallback = null,
  children,
}: I18nProviderProps<L>) => {
  const cacheRef = useRef(new Map<L, MessageDictionary>());
  const loadMessagesRef = useRef(loadMessages);
  loadMessagesRef.current = loadMessages;

  const readSync = (locale: L): MessageDictionary | null => {
    const cached = cacheRef.current.get(locale);
    if (cached) {
      return cached;
    }
    const loaded = loadMessagesRef.current(locale);
    if (isPromise(loaded)) {
      return null;
    }
    cacheRef.current.set(locale, loaded);
    return loaded;
  };

  const load = async (locale: L): Promise<MessageDictionary> => {
    const cached = cacheRef.current.get(locale);
    if (cached) {
      return cached;
    }
    const loaded = await loadMessagesRef.current(locale);
    cacheRef.current.set(locale, loaded);
    return loaded;
  };

  const [locale, setLocaleState] = useState<L>(initialLocale);
  const [active, setActive] = useState<MessageDictionary | null>(() => readSync(initialLocale));
  const [fallback, setFallback] = useState<MessageDictionary | null>(() =>
    fallbackLocale === initialLocale ? null : readSync(fallbackLocale),
  );

  // Keep the fallback dictionary available whenever the active locale differs from it.
  useEffect(() => {
    let cancelled = false;
    if (fallbackLocale !== locale && !fallback) {
      void load(fallbackLocale)
        .then((dictionary) => {
          if (!cancelled) setFallback(dictionary);
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallbackLocale, locale]);

  useEffect(() => {
    let cancelled = false;
    void load(locale)
      .then((dictionary) => {
        if (!cancelled) setActive(dictionary);
      })
      .catch(async () => {
        if (locale === fallbackLocale) return;
        const dictionary = await load(fallbackLocale).catch(() => null);
        if (!cancelled && dictionary) setActive(dictionary);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const setLocale = (nextLocale: L) => {
    void load(nextLocale)
      .then((dictionary) => {
        startTransition(() => {
          setActive(dictionary);
          setLocaleState(nextLocale);
        });
        onLocaleChange?.(nextLocale);
      })
      .catch(() => undefined);
  };

  const value = useMemo<I18nContextValue<L>>(
    () => ({
      locale,
      setLocale,
      t: (key: string, vars?: MessageVars) => translate(active, fallback, key, vars),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, fallback, locale],
  );

  if (!active && !fallback) {
    return <>{loadingFallback}</>;
  }

  return (
    <I18nContext.Provider value={value as unknown as I18nContextValue<string>}>
      {children}
    </I18nContext.Provider>
  );
};
