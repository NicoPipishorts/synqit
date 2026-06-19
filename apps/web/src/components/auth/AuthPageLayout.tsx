import { Home, LogIn, Share2, Tag } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

import { AuthHeroImage } from './AuthHeroImage';
import { useI18n } from '../../hooks/useI18n';
import { LanguageSwitcher } from '../ui/LanguageSwitcher';
import { PublicMobileNav, type PublicMobileNavItem } from '../ui/PublicMobileNav';

type AuthPageLayoutProps = {
  title: string;
  description?: string;
  children: ReactNode;
  mobileNavActiveId?: string | null;
  showMobileNav?: boolean;
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const getSiteOrigin = (): string => {
  const configured = import.meta.env.VITE_SITE_URL?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:4173';
  }

  const { protocol, hostname } = window.location;
  if (hostname === '127.0.0.1' || hostname === 'localhost') {
    return `${protocol}//${hostname === 'localhost' ? 'localhost' : '127.0.0.1'}:4173`;
  }

  return `${protocol}//${hostname.replace(/^app\./, '')}`;
};

export const AuthPageLayout = ({
  title,
  description,
  children,
  mobileNavActiveId = null,
  showMobileNav = false,
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
    { id: 'product', href: `${siteOrigin}/`, label: t('home.nav.product'), icon: Home },
    { id: 'pricing', href: `${siteOrigin}/pricing`, label: t('home.pricing.navLink'), icon: Tag },
    { id: 'share', href: '/auth/register', label: t('home.nav.share'), icon: Share2 },
    { id: 'login', href: '/auth/login', label: t('home.hero.ctaLogin'), icon: LogIn },
  ];

  return (
    <section className="relative min-h-dvh w-full">
      <div className="grid min-h-dvh w-full lg:grid-cols-2">
        {/* Form — centered horizontally + vertically */}
        <div className="flex min-h-dvh flex-col items-center justify-center px-6 pb-[max(7rem,calc(env(safe-area-inset-bottom)+5.5rem))] pt-[max(7rem,calc(env(safe-area-inset-top)+6rem))] lg:px-12">
          <div className="grid w-full max-w-md gap-6">
            <div className="grid w-full gap-2 text-center">
              <h1 className="text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-4xl">
                {title}
              </h1>
              {description ? (
                <p className="text-sm text-app-text-secondary">{description}</p>
              ) : null}
            </div>

            {children}

            <div className="flex w-full justify-center">
              <div className="flex items-center rounded-full border border-app-border/70 bg-app-elevated/90 px-2 py-1.5 shadow-soft-lift backdrop-blur-md dark:bg-app-card/90">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>

        {/* Skewed product screen grab — larger on the right, receding toward the center */}
        <div
          aria-hidden="true"
          className="relative hidden overflow-hidden lg:block"
          style={{ perspective: '1200px' }}
        >
          <div className="absolute inset-0 flex items-end -bottom-20">
            <div className="h-[78%] w-[120%]">
              <div className="h-full w-full overflow-hidden">
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
