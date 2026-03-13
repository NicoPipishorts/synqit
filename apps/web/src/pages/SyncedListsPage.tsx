import { useI18n } from '../hooks/useI18n';

export const SyncedListsPage = () => {
  const { t } = useI18n();

  return (
    <section className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div className="relative w-85 sm:w-[35vw] p-6 sm:p-10">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-7 w-7 rounded-tl-lg border-l border-t border-brand-dark dark:border-brand-white"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 h-7 w-7 rounded-tr-lg border-r border-t border-brand-dark dark:border-brand-white"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-7 w-7 rounded-bl-lg border-b border-l border-brand-dark dark:border-brand-white"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 h-7 w-7 rounded-br-lg border-b border-r border-brand-dark dark:border-brand-white"
        />
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-3xl">
            {t('syncedListsPage.comingSoon')}
          </h1>
          <p className="text-sm text-app-text-secondary sm:text-base">
            {t('syncedListsPage.title')}
          </p>
          <p className="text-sm text-app-text-secondary sm:text-base">
            {t('syncedListsPage.comingSoonBody')}
          </p>
        </div>
      </div>
    </section>
  );
};
