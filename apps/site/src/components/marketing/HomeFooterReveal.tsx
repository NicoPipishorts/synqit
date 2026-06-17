import { buildAppUrl } from '../../lib/app-url';
import { useI18n } from '../../lib/i18n';
import { BrandLogo } from '../ui/BrandLogo';
import { LanguageToggle } from '../ui/LanguageToggle';
import { ThemeToggle } from '../ui/ThemeToggle';

export const HomeFooterReveal = () => {
  const { t } = useI18n();

  return (
    <footer className="fixed inset-x-0 bottom-0 z-0 bg-brand-dark text-brand-white dark:bg-brand-white dark:text-brand-dark sm:h-96 lg:h-104">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col justify-between px-4 pb-28 pt-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr] lg:gap-10">
          <div className="grid content-start gap-3">
            <div className="flex items-center justify-between">
              <a href="/" className="w-fit">
                <BrandLogo className="h-10 w-auto" />
              </a>
              <div className="flex items-center gap-2 sm:hidden">
                <LanguageToggle />
                <ThemeToggle />
              </div>
            </div>
            <p className="hidden sm:block max-w-sm text-sm text-brand-white/80 dark:text-brand-dark/75 sm:text-base">
              {t('footer.description')}
            </p>
            <div className="hidden sm:flex flex-wrap items-center gap-3">
              <img
                src="/assets/logos/Providers/Spotify.png"
                alt="Spotify"
                className="h-7 w-auto"
                loading="lazy"
                decoding="async"
              />
              <img
                src="/assets/logos/Providers/AppleMusic.png"
                alt="Apple Music"
                className="h-7 w-auto"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>

          {/* mobile only: quick links side by side (left aligned / right aligned),
              with the description + provider icons stacked beneath them. */}
          <div className="grid gap-6 sm:hidden">
            <div className="flex justify-between gap-4 text-sm px-3">
              <div className="grid content-start gap-2 text-left">
                <p className="text-xs font-black uppercase tracking-wide text-brand-white/50 dark:text-brand-dark/50">
                  {t('footer.product')}
                </p>
                <a href="/" className="hover:text-brand-lime">
                  {t('footer.home')}
                </a>
                <a href="/pricing" className="hover:text-brand-lime">
                  {t('home.pricing.navLink')}
                </a>
                <a href={buildAppUrl('/auth/register')} className="hover:text-brand-lime">
                  {t('footer.start')}
                </a>
                <a href={buildAppUrl('/auth/login')} className="hover:text-brand-lime">
                  {t('footer.login')}
                </a>
              </div>
              <div className="grid content-start gap-2 text-right">
                <p className="text-xs font-black uppercase tracking-wide text-brand-white/50 dark:text-brand-dark/50">
                  {t('footer.platform')}
                </p>
                <a href={buildAppUrl('/playlists')} className="hover:text-brand-lime">
                  {t('footer.events')}
                </a>
                <a href={buildAppUrl('/profile/platforms')} className="hover:text-brand-lime">
                  {t('footer.connections')}
                </a>
                <a href={buildAppUrl('/playlists/new')} className="hover:text-brand-lime">
                  {t('footer.createEvent')}
                </a>
              </div>
            </div>

            <div className="grid gap-3 pg-5 px-2 mt-5">
              <p className="max-w-sm text-sm text-center text-brand-white/80 dark:text-brand-dark/75">
                {t('footer.description')}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <img
                  src="/assets/logos/Providers/Spotify.png"
                  alt="Spotify"
                  className="h-7 w-auto"
                  loading="lazy"
                  decoding="async"
                />
                <img
                  src="/assets/logos/Providers/AppleMusic.png"
                  alt="Apple Music"
                  className="h-7 w-auto"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </div>
          </div>

          <div className="hidden content-start gap-2 text-sm sm:grid">
            <p className="text-xs font-black uppercase tracking-wide text-brand-white/50 dark:text-brand-dark/50">
              {t('footer.product')}
            </p>
            <a href="/" className="hover:text-brand-lime">
              {t('footer.home')}
            </a>
            <a href="/pricing" className="hover:text-brand-lime">
              {t('home.pricing.navLink')}
            </a>
            <a href={buildAppUrl('/auth/register')} className="hover:text-brand-lime">
              {t('footer.start')}
            </a>
            <a href={buildAppUrl('/auth/login')} className="hover:text-brand-lime">
              {t('footer.login')}
            </a>
          </div>

          <div className="hidden content-start gap-2 text-sm sm:grid">
            <p className="text-xs font-black uppercase tracking-wide text-brand-white/50 dark:text-brand-dark/50">
              {t('footer.platform')}
            </p>
            <a href={buildAppUrl('/playlists')} className="hover:text-brand-lime">
              {t('footer.events')}
            </a>
            <a href={buildAppUrl('/profile/platforms')} className="hover:text-brand-lime">
              {t('footer.connections')}
            </a>
            <a href={buildAppUrl('/playlists/new')} className="hover:text-brand-lime">
              {t('footer.createEvent')}
            </a>
          </div>
        </div>

        <div className="flex items-center justify-center sm:border-t border-brand-white/20 pt-3 dark:border-brand-dark/20">
          <p className="text-xs text-brand-white/55 dark:text-brand-dark/55">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>
          <div className="hidden sm:flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
};
