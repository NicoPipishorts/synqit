import { Sticker } from '@synqit/ui';

import { FaqSection } from './components/marketing/FaqSection';
import { MarketingPageShell } from './components/marketing/MarketingPageShell';
import { HeroLink } from './components/ui/HeroLink';
import { buildAppUrl } from './lib/app-url';
import { useI18n } from './lib/i18n';

export const FaqPage = () => {
  const { t } = useI18n();

  return (
    <MarketingPageShell contentClassName="relative z-10 mx-auto w-full max-w-4xl px-5 pb-28 pt-28 sm:px-6 sm:pt-40 lg:px-8">
      <header className="mb-10 flex flex-col items-start gap-4 sm:mb-14">
        <Sticker tone="pink" tilt="-rotate-2">
          {t('home.faq.sticker')}
        </Sticker>
        <h1 className="text-4xl font-black leading-[1.02] tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
          {t('home.faq.title')}
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-app-text-secondary sm:text-lg">
          {t('home.faq.lead')}
        </p>
      </header>

      <FaqSection />

      <div className="mt-12 flex flex-wrap items-center gap-4 sm:mt-16">
        <HeroLink href={buildAppUrl('/auth/register')} variant="lime" size="md">
          {t('home.faq.cta')}
        </HeroLink>
        <a
          href="/"
          className="focus-ring-brand rounded-full py-2 text-sm font-bold text-app-text underline decoration-brand-pink decoration-2 underline-offset-4 transition hover:text-brand-pink"
        >
          {t('home.faq.backHome')}
        </a>
      </div>
    </MarketingPageShell>
  );
};
