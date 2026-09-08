import { BrandLogo, CONNECT_SERVICES, LINK_SERVICES, ServiceLogo } from '@synqit/ui';
import { Link } from '@tanstack/react-router';

import { useI18n } from '../../hooks/useI18n';
import { HeroCtaLink } from '../ui/HeroCtaLink';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { ThemeToggle } from '../ui/ThemeToggle';

type HomeFooterRevealProps = {
  /** Painted only when the page sheet's end is near, so unpainted scroll tiles never show it. */
  visible?: boolean;
};

export const HomeFooterReveal = ({ visible = true }: HomeFooterRevealProps) => {
  const { t } = useI18n();

  return (
    <footer
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-0 h-[28rem] bg-brand-dark text-brand-white transition-opacity duration-300 dark:bg-brand-white dark:text-brand-dark sm:h-[24rem] lg:h-[26rem] ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col justify-between px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1.2fr] lg:gap-10">
          <div className="grid content-center gap-3">
            <BrandLogo className="h-10 w-auto" />
            <p className="max-w-sm text-sm text-center text-brand-white/80 dark:text-brand-dark/75">
              {t('footer.description')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {CONNECT_SERVICES.map((service) => (
                <ServiceLogo key={service.id} service={service.id} className="h-7 w-7" />
              ))}
              <span aria-hidden className="h-5 w-px bg-current opacity-20" />
              {LINK_SERVICES.map((service) => (
                <ServiceLogo key={service.id} service={service.id} className="h-7 w-7" />
              ))}
            </div>
          </div>

          <div className="hidden content-start gap-2 text-sm sm:grid">
            <p className="text-xs font-black uppercase tracking-wide text-brand-white/50 dark:text-brand-dark/50">
              {t('footer.product')}
            </p>
            <Link to="/" className="hover:text-brand-lime">
              {t('footer.home')}
            </Link>
            <Link to="/auth/register" className="hover:text-brand-lime">
              {t('footer.start')}
            </Link>
            <Link to="/auth/login" className="hover:text-brand-lime">
              {t('footer.login')}
            </Link>
          </div>

          <div className="hidden content-start gap-2 text-sm sm:grid">
            <p className="text-xs font-black uppercase tracking-wide text-brand-white/50 dark:text-brand-dark/50">
              {t('footer.platform')}
            </p>
            <Link to="/playlists" className="hover:text-brand-lime">
              {t('footer.events')}
            </Link>
            <Link to="/profile/platforms" className="hover:text-brand-lime">
              {t('footer.connections')}
            </Link>
            <Link to="/playlists/new" className="hover:text-brand-lime">
              {t('footer.createEvent')}
            </Link>
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
              <HeroCtaLink to="/auth/register" variant="lime" size="sm">
                {t('footer.getStarted')}
              </HeroCtaLink>
              <HeroCtaLink to="/auth/login" variant="outline" size="sm">
                {t('footer.dashboard')}
              </HeroCtaLink>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:border-t border-brand-white/20 pt-3 dark:border-brand-dark/20">
          <p className="text-xs text-brand-white/55 dark:text-brand-dark/55">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
};
