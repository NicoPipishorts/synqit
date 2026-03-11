export type Locale = 'en' | 'fr';
export type MessageDictionary = Record<string, unknown>;

const localeLoaders: Record<Locale, () => Promise<MessageDictionary>> = {
  en: () => import('../../locales/en/common.json').then((module) => module.default),
  fr: () => import('../../locales/fr/common.json').then((module) => module.default),
};

const messageCache = new Map<Locale, MessageDictionary>();

export const loadLocaleMessages = async (locale: Locale): Promise<MessageDictionary> => {
  const cachedMessages = messageCache.get(locale);
  if (cachedMessages) {
    return cachedMessages;
  }

  const loadedMessages = await localeLoaders[locale]();
  messageCache.set(locale, loadedMessages);
  return loadedMessages;
};
