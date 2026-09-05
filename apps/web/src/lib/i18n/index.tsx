import {
  I18nProvider as BaseI18nProvider,
  detectBrowserLocale,
  readLocaleFromQuery,
} from '@synqit/i18n';
import { RouteLoadingScreen } from '@synqit/ui';
import { ReactNode } from 'react';

import { loadLocaleMessages, Locale, SUPPORTED_LOCALES } from './messages';
import { isAuthenticated } from '../auth';
import { loadAnonymousPreferences, saveAnonymousPreferences } from '../preferences';
import { updateUserPreferences } from '../queries';

// The marketing site (different subdomain → separate localStorage) forwards the
// visitor's chosen locale via `?lang=`. It wins over stored preferences because
// it reflects the choice just made on the site before landing here.
const detectInitialLocale = (): Locale => {
  const urlLocale = readLocaleFromQuery(SUPPORTED_LOCALES);
  if (urlLocale) {
    saveAnonymousPreferences({ locale: urlLocale });
    return urlLocale;
  }
  return loadAnonymousPreferences().locale ?? detectBrowserLocale(SUPPORTED_LOCALES, 'en');
};

// Public playlist pages render their own skeleton; don't block them on the dictionary.
const shouldBypassBootLoader = (): boolean =>
  typeof window !== 'undefined' &&
  (window.location.pathname.startsWith('/playlist/') ||
    window.location.pathname.startsWith('/event/'));

const persistLocale = (locale: Locale): void => {
  saveAnonymousPreferences({ locale });
  if (isAuthenticated()) {
    void updateUserPreferences({ locale }).catch(() => undefined);
  }
};

export const I18nProvider = ({ children }: { children: ReactNode }) => (
  <BaseI18nProvider<Locale>
    initialLocale={detectInitialLocale()}
    fallbackLocale="en"
    loadMessages={loadLocaleMessages}
    onLocaleChange={persistLocale}
    loadingFallback={shouldBypassBootLoader() ? null : <RouteLoadingScreen />}
  >
    {children}
  </BaseI18nProvider>
);
