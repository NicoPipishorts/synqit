import { LanguageSwitcher, type LanguageOption } from '@synqit/ui';

import { useI18n } from '../../lib/i18n';

type Locale = 'en' | 'fr';

const LANGUAGE_OPTIONS: LanguageOption<Locale>[] = [
  {
    locale: 'en',
    iconSrc: '/assets/flags/USA.png',
    iconAlt: 'United States flag',
    name: 'English',
  },
  { locale: 'fr', iconSrc: '/assets/flags/FR.png', iconAlt: 'French flag', name: 'Français' },
];

/** Site-bound language toggle over the shared LanguageSwitcher. */
export const LanguageToggle = () => {
  const { locale, setLocale } = useI18n();
  return (
    <LanguageSwitcher
      value={locale}
      options={LANGUAGE_OPTIONS}
      onChange={setLocale}
      openLabel="Select language"
      selectLabel={(name) => `Switch to ${name}`}
    />
  );
};
