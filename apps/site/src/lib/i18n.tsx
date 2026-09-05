import { safeStorageGet, safeStorageSet } from '@synqit/client';
import {
  I18nProvider as BaseI18nProvider,
  detectBrowserLocale,
  isSupportedLocale,
  useI18nContext,
} from '@synqit/i18n';
import { ReactNode } from 'react';

import en from '../../../web/src/locales/en/common.json';
import fr from '../../../web/src/locales/fr/common.json';

// Keep in sync with lib/app-url.ts, which forwards this choice to the app via `?lang=`.
const LOCALE_STORAGE_KEY = 'synqit.site.locale.v1';

const messages = { en, fr } as const;
export type Locale = keyof typeof messages;
const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'fr'];

const detectInitialLocale = (): Locale => {
  const stored = safeStorageGet(LOCALE_STORAGE_KEY);
  return isSupportedLocale(SUPPORTED_LOCALES, stored)
    ? stored
    : detectBrowserLocale(SUPPORTED_LOCALES, 'en');
};

export const I18nProvider = ({ children }: { children: ReactNode }) => (
  <BaseI18nProvider<Locale>
    initialLocale={detectInitialLocale()}
    fallbackLocale="en"
    loadMessages={(locale) => messages[locale]}
    onLocaleChange={(locale) => safeStorageSet(LOCALE_STORAGE_KEY, locale)}
  >
    {children}
  </BaseI18nProvider>
);

export const useI18n = () => useI18nContext<Locale>();
