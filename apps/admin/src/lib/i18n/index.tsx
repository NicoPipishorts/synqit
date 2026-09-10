import {
  I18nProvider as BaseI18nProvider,
  detectBrowserLocale,
  isSupportedLocale,
} from '@synqit/i18n';
import { ReactNode } from 'react';

import { Locale, messages } from './messages';
import { loadAnonymousPreferences, saveAnonymousPreferences } from '../preferences';

// The back office is not translated beyond these two; a stored preference in a
// locale only the product apps offer (es) falls back to browser detection.
const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'fr'];

const detectInitialLocale = (): Locale => {
  const stored = loadAnonymousPreferences().locale;
  return isSupportedLocale(SUPPORTED_LOCALES, stored)
    ? stored
    : detectBrowserLocale(SUPPORTED_LOCALES, 'en');
};

/** Admin reuses the web dictionaries, bundled statically so there is no boot loader. */
export const I18nProvider = ({ children }: { children: ReactNode }) => (
  <BaseI18nProvider<Locale>
    initialLocale={detectInitialLocale()}
    fallbackLocale="en"
    loadMessages={(locale) => messages[locale]}
    onLocaleChange={(locale) => saveAnonymousPreferences({ locale })}
  >
    {children}
  </BaseI18nProvider>
);
