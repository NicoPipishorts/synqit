import { ProviderConnectionsPage } from './ProviderConnectionsPage';
import { CircleChevronBackButton } from '../components/ui/CircleChevronBackButton';
import { useI18n } from '../hooks/useI18n';

export const ProfilePlatformsPage = () => {
  const { t } = useI18n();

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 top-8 h-44 w-52 rounded-full bg-brand-lime/25 blur-[95px] sm:h-56 sm:w-64"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 top-20 h-52 w-56 rounded-full bg-brand-pink/25 blur-[105px] sm:h-64 sm:w-72"
      />

      <div className="relative grid gap-6">
        <article>
          <div className="flex items-start gap-4 px-5 py-7 sm:px-8 sm:py-9">
            <CircleChevronBackButton to="/profile" label={t('profile.backToProfile')} />
            <div className="grid gap-1">
              <h1 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
                {t('profile.platformsTitle')}
              </h1>
              <p className="text-sm text-app-text-secondary sm:text-base">
                {t('profile.platformsDescription')}
              </p>
            </div>
          </div>
        </article>

        <ProviderConnectionsPage />
      </div>
    </section>
  );
};
