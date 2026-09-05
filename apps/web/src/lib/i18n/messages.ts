import type { MessageDictionary } from '@synqit/i18n';

export type Locale = 'en' | 'fr';
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'fr'];
export type { MessageDictionary };

// Code-split so the initial bundle carries one dictionary at most.
const localeLoaders: Record<Locale, () => Promise<MessageDictionary>> = {
  en: () => import('../../locales/en/common.json').then((module) => module.default),
  fr: () => import('../../locales/fr/common.json').then((module) => module.default),
};

export const loadLocaleMessages = (locale: Locale): Promise<MessageDictionary> =>
  localeLoaders[locale]();
