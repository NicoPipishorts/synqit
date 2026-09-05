import { I18nProvider as BaseI18nProvider, detectBrowserLocale } from '@synqit/i18n';
import { ReactNode } from 'react';

import { Locale, messages } from './messages';
import { loadAnonymousPreferences, saveAnonymousPreferences } from '../preferences';

const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'fr'];

const detectInitialLocale = (): Locale =>
  loadAnonymousPreferences().locale ?? detectBrowserLocale(SUPPORTED_LOCALES, 'en');

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
