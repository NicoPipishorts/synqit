import en from '../../locales/en/common.json';
import fr from '../../locales/fr/common.json';

export const messages = {
  en,
  fr,
} as const;

export type Locale = keyof typeof messages;
