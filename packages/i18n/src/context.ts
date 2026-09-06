import { createContext, useContext } from 'react';

import type { MessageVars } from './messages';

export type I18nContextValue<L extends string = string> = {
  locale: L;
  setLocale: (nextLocale: L) => void;
  t: (key: string, vars?: MessageVars) => string;
};

export const I18nContext = createContext<I18nContextValue<string> | null>(null);

/**
 * Returns the current locale, a setter, and `t`. Apps wrap this in a typed hook
 * (`useI18n = () => useI18nContext<'en' | 'fr'>()`).
 */
export const useI18nContext = <L extends string = string>(): I18nContextValue<L> => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }

  return context as unknown as I18nContextValue<L>;
};
