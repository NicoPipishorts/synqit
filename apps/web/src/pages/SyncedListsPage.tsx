import { BrandLogo } from '../components/ui/BrandLogo';
import { useI18n } from '../hooks/useI18n';

export const SyncedListsPage = () => {
  const { t } = useI18n();

  return (
    <section className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <article className="w-full max-w-2xl rounded-2xl border border-app-border bg-app-elevated p-6 text-center shadow-soft-lift dark:bg-app-card sm:p-8">
        <div className="mx-auto mb-4 flex justify-center">
          <BrandLogo className="h-10 w-auto sm:h-12" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
          {t('syncedListsPage.comingSoon')}
        </h1>
        <p className="mt-2 text-sm text-app-text-secondary sm:text-base">
          {t('syncedListsPage.title')}
        </p>
        <p className="mt-4 text-sm text-app-text-secondary sm:text-base">
          {t('syncedListsPage.comingSoonBody')}
        </p>
      </article>
    </section>
  );
};
