import { Sticker } from '@synqit/ui';

import { MarketingPageShell } from './components/marketing/MarketingPageShell';
import { type PricingTable } from './components/marketing/PricingComparison';
import { PricingTableBlock } from './components/marketing/PricingTableBlock';
import { HeroLink } from './components/ui/HeroLink';
import { useI18n } from './lib/i18n';

const EVENTS_TABLE: PricingTable = {
  planKeys: ['events.free', 'events.party', 'events.celebration'],
  recommendedIndex: 1,
  sections: [
    {
      label: 'eventBasics',
      rows: [
        { label: 'magicLink', cells: [true, true, true] },
        { label: 'moderation', cells: [true, true, true] },
        { label: 'guestCap', cells: ['cap25', 'unlimited', 'unlimited'] },
        { label: 'branding', cells: ['shown', 'removed', 'removed'] },
        { label: 'cohosts', cells: [false, false, true] },
      ],
    },
    {
      label: 'keepsake',
      rows: [
        { label: 'exportPlaylist', cells: [false, true, true] },
        { label: 'recapPage', cells: [false, true, true] },
        { label: 'pdf', cells: [false, false, true] },
        { label: 'retention', cells: ['days30', 'forever', 'forever'] },
      ],
    },
  ],
};

const SHARING_TABLE: PricingTable = {
  planKeys: ['sharing.free', 'sharing.unlock', 'sharing.curators'],
  recommendedIndex: 1,
  sections: [
    {
      label: 'sharingBasics',
      rows: [
        { label: 'crossPlatform', cells: [true, true, true] },
        { label: 'subscribers', cells: ['cap25', 'unlimited', 'unlimited'] },
        { label: 'syncLifetime', cells: ['days60', 'noLimit', 'noLimit'] },
        { label: 'oneWaySync', cells: [true, true, true] },
      ],
    },
    {
      label: 'curators',
      rows: [
        { label: 'brandedPage', cells: [false, true, true] },
        { label: 'stats', cells: [false, 'basic', 'advanced'] },
        { label: 'mirroring', cells: [false, false, true] },
        { label: 'biSync', cells: [false, false, true] },
        { label: 'unlimitedPlaylists', cells: [false, false, true] },
        { label: 'channelPage', cells: [false, false, true] },
        { label: 'seats', cells: [false, false, true] },
      ],
    },
  ],
};

export const PricingPage = () => {
  const { t } = useI18n();

  return (
    <MarketingPageShell contentClassName="relative mx-auto w-full max-w-6xl px-5 pb-28 pt-28 sm:px-6 sm:pt-40 lg:px-8">
      <header className="relative mb-14 flex flex-col items-center gap-4 text-center sm:mb-20">
        <Sticker tone="paper" tilt="-rotate-2">
          {t('home.pricing.pill')}
        </Sticker>
        <h1 className="text-4xl font-black leading-[1.02] tracking-tight text-brand-dark dark:text-brand-white sm:text-6xl">
          {t('home.pricing.pageTitle')}
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-app-text-secondary sm:text-lg">
          {t('home.pricing.pageSubtitle')}
        </p>
      </header>

      <PricingTableBlock
        index="01"
        tone="lime"
        title={t('home.pricing.eventsTitle')}
        subtitle={t('home.pricing.eventsSubtitle')}
        table={EVENTS_TABLE}
      />
      <PricingTableBlock
        index="02"
        tone="pink"
        title={t('home.pricing.sharingTitle')}
        subtitle={t('home.pricing.sharingSubtitle')}
        table={SHARING_TABLE}
      />

      <p className="text-center text-xs text-app-text-muted">{t('home.pricing.footnote')}</p>
      <div className="mt-8 text-center">
        <HeroLink href="/" variant="outline" size="sm">
          ← {t('home.pricing.backHome')}
        </HeroLink>
      </div>
    </MarketingPageShell>
  );
};
