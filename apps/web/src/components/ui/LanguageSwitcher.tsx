import {
  LanguageChoices as UiLanguageChoices,
  LanguageSwitcher as UiLanguageSwitcher,
  type LanguageOption,
} from '@synqit/ui';

import { useI18n } from '../../hooks/useI18n';
import { Locale } from '../../lib/i18n/messages';

/** The locales on offer, shared by both shapes of the control. */
const useLanguageOptions = (): LanguageOption<Locale>[] => {
  const { t } = useI18n();
  return [
    {
      locale: 'en',
      iconSrc: '/assets/flags/USA.png',
      iconAlt: 'United States flag',
      name: t('languageSwitcher.english'),
    },
    {
      locale: 'fr',
      iconSrc: '/assets/flags/FR.png',
      iconAlt: 'French flag',
      name: t('languageSwitcher.french'),
    },
  ];
};

/** App-bound LanguageSwitcher: reads and writes the i18n locale. */
export const LanguageSwitcher = ({ className }: { className?: string }) => {
  const { locale, setLocale, t } = useI18n();
  const options = useLanguageOptions();

  return (
    <UiLanguageSwitcher
      value={locale}
      options={options}
      onChange={setLocale}
      openLabel={t('languageSwitcher.ariaOpen')}
      selectLabel={(language) => t('languageSwitcher.ariaSelect', { language })}
      className={className}
    />
  );
};

/** Every locale side by side, for surfaces with the room to show them all. */
export const LanguageChoices = ({ className }: { className?: string }) => {
  const { locale, setLocale, t } = useI18n();
  const options = useLanguageOptions();

  return (
    <UiLanguageChoices
      value={locale}
      options={options}
      onChange={setLocale}
      selectLabel={(language) => t('languageSwitcher.ariaSelect', { language })}
      className={className}
    />
  );
};
