import { MarketingPageShell } from './components/marketing/MarketingPageShell';
import { type PricingTable } from './components/marketing/PricingComparison';
import { PricingTableBlock } from './components/marketing/PricingTableBlock';
import { SectionHeading } from './components/marketing/SectionHeading';
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
    <MarketingPageShell contentClassName="mx-auto w-full max-w-6xl px-4 pb-24 pt-32 sm:px-6 sm:pt-40 lg:px-8">
      <div className="mb-14 text-center">
        <SectionHeading
          title={t('home.pricing.pageTitle')}
          description={t('home.pricing.pageSubtitle')}
          align="center"
          titleClassName="text-4xl font-black tracking-tight sm:text-5xl"
          descriptionClassName="mx-auto mt-4 max-w-xl leading-relaxed"
        />
      </div>

      <PricingTableBlock
        title={t('home.pricing.eventsTitle')}
        subtitle={t('home.pricing.eventsSubtitle')}
        table={EVENTS_TABLE}
      />
      <PricingTableBlock
        title={t('home.pricing.sharingTitle')}
        subtitle={t('home.pricing.sharingSubtitle')}
        table={SHARING_TABLE}
      />

      <p className="mt-2 text-center text-xs text-app-text-muted">{t('home.pricing.footnote')}</p>
      <div className="mt-10 text-center">
        <HeroLink href="/" variant="outline" size="sm">
          ← {t('home.pricing.backHome')}
        </HeroLink>
      </div>
    </MarketingPageShell>
  );
};
