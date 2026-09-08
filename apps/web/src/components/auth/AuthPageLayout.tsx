import {
  CONNECT_SERVICES,
  Highlight,
  LINK_SERVICES,
  PublicMobileNav,
  ServiceLogo,
  Sticker,
  type PublicMobileNavItem,
} from '@synqit/ui';
import { Home, LogIn, Share2, Tag } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

import { AuthHeroImage } from './AuthHeroImage';
import { useI18n } from '../../hooks/useI18n';
import { getSiteOrigin } from '../../lib/site-url';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';

type AuthPageLayoutProps = {
  /** Short sticker label above the title, e.g. "Login". */
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  mobileNavActiveId?: string | null;
  showMobileNav?: boolean;
  /**
   * Show which services Synqit works with. On for sign-in and sign-up, where someone
   * is deciding whether it covers the app they listen on; off for password recovery,
   * where they already have an account and it is only noise.
   */
  showServiceCompatibility?: boolean;
};

export const AuthPageLayout = ({
  eyebrow,
  title,
  description,
  children,
  mobileNavActiveId = null,
  showMobileNav = false,
  showServiceCompatibility = false,
}: AuthPageLayoutProps) => {
  const { t } = useI18n();
  const [selectedMobileNavItem, setSelectedMobileNavItem] = useState<string | null>(
    mobileNavActiveId,
  );
  const siteOrigin = getSiteOrigin();

  useEffect(() => {
    setSelectedMobileNavItem(mobileNavActiveId);
  }, [mobileNavActiveId]);

  const mobileNavItems: PublicMobileNavItem[] = [
    {
      id: 'product',
      href: `${siteOrigin}/`,
      label: t('home.nav.product'),
      icon: <Home size={18} aria-hidden="true" />,
    },
    {
      id: 'pricing',
      href: `${siteOrigin}/pricing`,
      label: t('home.pricing.navLink'),
      icon: <Tag size={18} aria-hidden="true" />,
    },
    {
      id: 'share',
      href: '/auth/register',
      label: t('home.nav.share'),
      icon: <Share2 size={18} aria-hidden="true" />,
    },
    {
      id: 'login',
      href: '/auth/login',
      label: t('home.hero.ctaLogin'),
      icon: <LogIn size={18} aria-hidden="true" />,
    },
  ];

  return (
    <section className="relative min-h-dvh w-full">
      <div className="grid min-h-dvh w-full lg:grid-cols-2">
        {/* Form — sticker card, centered */}
        <div className="relative flex min-h-dvh flex-col items-center justify-center px-5 pb-[max(7rem,calc(env(safe-area-inset-bottom)+5.5rem))] pt-[max(7rem,calc(env(safe-area-inset-top)+6rem))] sm:px-6 lg:px-12">
          <div
            aria-hidden="true"
            className="bg-halftone pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_85%)]"
          />
          <div className="relative grid w-full max-w-md gap-6">
            <div className="flex flex-col items-center gap-3 text-center">
              {eyebrow ? (
                <Sticker tone="paper" tilt="-rotate-2">
                  {eyebrow}
                </Sticker>
              ) : null}
              <h1 className="text-3xl font-black leading-[1.05] tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
                <Highlight>{title}</Highlight>
              </h1>
              {description ? (
                <p className="max-w-sm text-sm leading-relaxed text-app-text-secondary">
                  {description}
                </p>
              ) : null}
            </div>

            <div className="relative rounded-3xl border-2 border-app-text bg-app-elevated p-5 shadow-[5px_5px_0_0_var(--syn-text),10px_10px_0_0_var(--color-brand-lime)] dark:bg-app-card sm:p-7">
              <span
                aria-hidden="true"
                className="absolute -top-3 left-8 h-5 w-16 -rotate-6 rounded-sm bg-brand-lime/80"
              />
              <span
                aria-hidden="true"
                className="absolute -bottom-3 right-10 h-5 w-14 rotate-3 rounded-sm bg-brand-pink/70"
              />
              {children}
            </div>

            {showServiceCompatibility ? (
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="text-[11px] font-black uppercase tracking-[0.18em] text-app-text-muted">
                  {t('home.compatStrip.label')}
                </span>
                <span className="flex items-center gap-2.5">
                  {[...CONNECT_SERVICES, ...LINK_SERVICES].map((service) => (
                    <ServiceLogo key={service.id} service={service.id} className="h-6 w-6" />
                  ))}
                </span>
                <a
                  href={`${siteOrigin}/faq#matrix`}
                  className="focus-ring-brand rounded-full text-xs font-bold text-app-text-secondary underline decoration-brand-pink decoration-2 underline-offset-4 transition hover:text-brand-pink"
                >
                  {t('home.compatStrip.cta')}
                </a>
              </div>
            ) : null}

            <div className="flex w-full justify-center">
              <div className="flex items-center rounded-full border border-app-border/70 bg-app-elevated/90 px-2 py-1.5 shadow-soft-lift backdrop-blur-md dark:bg-app-card/90">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>

        {/* Product shot in a tilted sticker frame — same language as the site hero.
            Oversized on purpose: it bleeds off the right edge of the panel. */}
        <div
          aria-hidden="true"
          className="relative hidden items-center overflow-hidden py-16 pl-8 lg:flex xl:pl-14"
        >
          <div className="absolute left-[5%] top-[10%] h-[55%] w-[60%] rounded-full bg-brand-lime/35 blur-3xl dark:bg-brand-lime/20" />
          <div className="absolute bottom-[8%] right-[-5%] h-[50%] w-[55%] rounded-full bg-brand-pink/30 blur-3xl dark:bg-brand-pink/20" />
          <div className="relative w-[112%] max-w-none shrink-0 -rotate-1">
            <div className="aspect-[17/12] overflow-hidden rounded-3xl border-2 border-app-text bg-app-card shadow-[6px_6px_0_0_var(--syn-text),12px_12px_0_0_var(--color-brand-pink)]">
              <div className="h-full w-full scale-[1.06]">
                <AuthHeroImage />
              </div>
            </div>
          </div>
        </div>
      </div>

      {showMobileNav ? (
        <PublicMobileNav
          items={mobileNavItems}
          activeId={selectedMobileNavItem}
          onActivate={setSelectedMobileNavItem}
          ariaLabel="Mobile navigation"
        />
      ) : null}
    </section>
  );
};
