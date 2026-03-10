import { createContext } from 'react';

import { Locale } from './messages';

export type I18nContextValue = {
  locale: Locale;
  setLocale: (nextLocale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

export const I18nContext = createContext<I18nContextValue | null>(null);
