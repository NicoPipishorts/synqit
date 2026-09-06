import { useI18nContext } from '@synqit/i18n';

import type { Locale } from '../lib/i18n/messages';

export const useI18n = () => useI18nContext<Locale>();
