import { useI18n } from '../../lib/i18n';

export const LanguageToggle = () => {
  const { locale, setLocale } = useI18n();

  return (
    <div className="inline-flex items-center rounded-full border border-brand-white/20 bg-brand-white/10 p-1 dark:border-brand-dark/20 dark:bg-brand-dark/10">
      {(['en', 'fr'] as const).map((option) => {
        const isActive = option === locale;
        return (
          <button
            key={option}
            type="button"
            onClick={() => setLocale(option)}
            className={`focus-ring-brand rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide transition ${
              isActive
                ? 'bg-brand-lime text-brand-dark'
                : 'text-brand-white/70 hover:text-brand-white dark:text-brand-dark/70 dark:hover:text-brand-dark'
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
};
