import type { MessageDictionary } from '@synqit/i18n';

export type Locale = 'en' | 'fr' | 'es';
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'fr', 'es'];
export type { MessageDictionary };

// Code-split so the initial bundle carries one dictionary at most.
const localeLoaders: Record<Locale, () => Promise<MessageDictionary>> = {
  en: () => import('../../locales/en/common.json').then((module) => module.default),
  fr: () => import('../../locales/fr/common.json').then((module) => module.default),
  es: () => import('../../locales/es/common.json').then((module) => module.default),
};

export const loadLocaleMessages = (locale: Locale): Promise<MessageDictionary> =>
  localeLoaders[locale]();

/** BCP 47 tag for `Intl.*`, which needs a region to format dates and numbers. */
const INTL_LOCALES: Record<Locale, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
};

export const intlLocale = (locale: Locale): string => INTL_LOCALES[locale] ?? 'en-US';
