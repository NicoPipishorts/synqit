import { buildAppUrl } from '../../lib/app-url';
import { useI18n } from '../../lib/i18n';
import { BrandLogo } from '../ui/BrandLogo';
import { HeroLink } from '../ui/HeroLink';
import { LanguageToggle } from '../ui/LanguageToggle';
import { ThemeToggle } from '../ui/ThemeToggle';

export const HomeFooterReveal = () => {
  const { t } = useI18n();

  return (
    <footer className="fixed inset-x-0 bottom-0 z-0 h-[28rem] bg-brand-dark text-brand-white dark:bg-brand-white dark:text-brand-dark sm:h-[24rem] lg:h-[26rem]">
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col justify-between px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1.2fr] lg:gap-10">
          <div className="grid content-start gap-3">
            <a href="/" className="w-fit">
              <BrandLogo className="h-10 w-auto" />
            </a>
            <p className="max-w-sm text-sm text-brand-white/80 dark:text-brand-dark/75 sm:text-base">
              {t('footer.description')}
            </p>
            <div className="flex flex-wrap items-center gap-3">
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

          <div className="hidden content-start gap-2 text-sm sm:grid">
            <p className="text-xs font-black uppercase tracking-wide text-brand-white/50 dark:text-brand-dark/50">
              {t('footer.product')}
            </p>
            <a href="/" className="hover:text-brand-lime">
              {t('footer.home')}
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

          <div className="rounded-2xl border border-brand-white/20 bg-brand-white/95 p-4 text-brand-dark dark:border-brand-dark/20 dark:bg-brand-dark dark:text-brand-white">
            <p className="text-xs font-black uppercase tracking-wide text-brand-dark/50 dark:text-brand-white/50">
              {t('footer.onePlan')}
            </p>
            <p className="mt-1 text-3xl font-black tracking-tight">{t('footer.freeMvp')}</p>
            <p className="mt-2 text-sm text-brand-dark/70 dark:text-brand-white/75">
              {t('footer.planDesc')}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <HeroLink href={buildAppUrl('/auth/register')} variant="lime" size="sm">
                {t('footer.getStarted')}
              </HeroLink>
              <HeroLink href={buildAppUrl('/auth/login')} variant="outline" size="sm">
                {t('footer.dashboard')}
              </HeroLink>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-brand-white/20 pt-3 dark:border-brand-dark/20">
          <p className="text-xs text-brand-white/55 dark:text-brand-dark/55">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
};
