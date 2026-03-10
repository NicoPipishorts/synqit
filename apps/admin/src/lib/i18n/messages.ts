import en from '../../../../web/src/locales/en/common.json';
import fr from '../../../../web/src/locales/fr/common.json';

export const messages = {
  en,
  fr,
} as const;

export type Locale = keyof typeof messages;
