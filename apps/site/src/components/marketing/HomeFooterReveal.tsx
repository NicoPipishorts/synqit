import { CONNECT_SERVICES, LINK_SERVICES, ServiceLogo } from '@synqit/ui';
import { type Ref } from 'react';

import { LEGAL_ROUTES } from '../../content/legal';
import { buildAppUrl } from '../../lib/app-url';
import { useI18n } from '../../lib/i18n';
import { LanguageToggle } from '../ui/LanguageToggle';
import { ThemeToggle } from '../ui/ThemeToggle';

type HomeFooterRevealProps = {
  /** Painted only when the bottom of the page sheet is near the viewport. */
  visible?: boolean;
  /** The shell measures the footer through this to size the spacer that reveals it. */
  ref?: Ref<HTMLElement>;
};

export const HomeFooterReveal = ({ visible = true, ref }: HomeFooterRevealProps) => {
  const { t } = useI18n();

  const legalLinks = [
    { href: LEGAL_ROUTES.privacy, label: t('footer.privacy') },
    { href: LEGAL_ROUTES.terms, label: t('footer.terms') },
    { href: LEGAL_ROUTES.cookies, label: t('footer.cookies') },
    { href: LEGAL_ROUTES['legal-notice'], label: t('footer.legalNotice') },
  ];

  // The footer sits fixed behind the page sheet and is revealed by the sheet's
  // bottom spacer. It stays unpainted (opacity 0) until the sheet's end is close,
  // so a tile Safari has not rasterised yet can never show the footer through
  // the middle of the page while scrolling.
  return (
    <footer
      ref={ref}
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-0 bg-brand-dark text-brand-white transition-opacity duration-300 dark:bg-brand-white dark:text-brand-dark sm:h-96 lg:h-104 ${
        visible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-10 px-4 pb-28 pt-12 sm:justify-center sm:gap-12 sm:px-6 sm:py-14 lg:gap-14 lg:px-8 lg:py-16">
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] lg:gap-10">
          <div className="grid content-start gap-3">
            <p className="hidden sm:block max-w-sm text-sm text-brand-white/80 dark:text-brand-dark/75 sm:text-base">
              {t('footer.description')}
            </p>
            <div className="hidden sm:flex flex-wrap items-center gap-3">
              {CONNECT_SERVICES.map((service) => (
                <ServiceLogo
                  key={service.id}
                  service={service.id}
                  className="h-5 w-5 sm:h-6 sm:w-6"
                />
              ))}
              <span aria-hidden className="h-5 w-px bg-current opacity-20" />
              {LINK_SERVICES.map((service) => (
                <ServiceLogo
                  key={service.id}
                  service={service.id}
                  className="h-5 w-5 sm:h-6 sm:w-6"
                />
              ))}
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
                <a href="/faq" className="hover:text-brand-lime">
                  {t('footer.faq')}
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

            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 px-3 text-sm">
              {legalLinks.map((link) => (
                <a key={link.href} href={link.href} className="hover:text-brand-lime">
                  {link.label}
                </a>
              ))}
            </div>

            <div className="grid gap-3 pg-5 px-2 mt-5">
              <p className="max-w-sm text-sm text-center text-brand-white/80 dark:text-brand-dark/75">
                {t('footer.description')}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {CONNECT_SERVICES.map((service) => (
                  <ServiceLogo
                    key={service.id}
                    service={service.id}
                    className="h-5 w-5 sm:h-6 sm:w-6"
                  />
                ))}
                <span aria-hidden className="h-5 w-px bg-current opacity-20" />
                {LINK_SERVICES.map((service) => (
                  <ServiceLogo
                    key={service.id}
                    service={service.id}
                    className="h-5 w-5 sm:h-6 sm:w-6"
                  />
                ))}
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
            <a href="/faq" className="hover:text-brand-lime">
              {t('footer.faq')}
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

          <div className="hidden content-start gap-2 text-sm sm:grid">
            <p className="text-xs font-black uppercase tracking-wide text-brand-white/50 dark:text-brand-dark/50">
              {t('footer.legal')}
            </p>
            {legalLinks.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-brand-lime">
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 border-brand-white/20 pt-5 dark:border-brand-dark/20 sm:border-t">
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
          <p className="text-xs text-brand-white/55 dark:text-brand-dark/55">
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>
    </footer>
  );
};
