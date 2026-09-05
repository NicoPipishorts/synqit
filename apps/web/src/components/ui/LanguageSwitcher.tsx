import { LanguageSwitcher as UiLanguageSwitcher, type LanguageOption } from '@synqit/ui';

import { useI18n } from '../../hooks/useI18n';
import { Locale } from '../../lib/i18n/messages';

/** App-bound LanguageSwitcher: reads and writes the i18n locale. */
export const LanguageSwitcher = () => {
  const { locale, setLocale, t } = useI18n();
  const options: LanguageOption<Locale>[] = [
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

  return (
    <UiLanguageSwitcher
      value={locale}
      options={options}
      onChange={setLocale}
      openLabel={t('languageSwitcher.ariaOpen')}
      selectLabel={(language) => t('languageSwitcher.ariaSelect', { language })}
    />
  );
};
