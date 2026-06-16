import { HomeFooterReveal } from './components/marketing/HomeFooterReveal';
import { PricingComparison, type PricingTable } from './components/marketing/PricingComparison';
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

const TableBlock = ({
  title,
  subtitle,
  table,
}: {
  title: string;
  subtitle: string;
  table: PricingTable;
}) => (
  <section className="mb-16">
    <div className="mb-6">
      <h2 className="text-2xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-3xl">
        {title}
      </h2>
      <p className="mt-1 text-sm text-app-text-secondary sm:text-base">{subtitle}</p>
    </div>
    <PricingComparison table={table} />
  </section>
);

export const PricingPage = () => {
  const { t } = useI18n();

  return (
    <div className="relative bg-brand-dark dark:bg-brand-white">
      <HomeFooterReveal />

      <div className="relative z-10 overflow-hidden rounded-b-[2.75rem] bg-app-bg shadow-[0_28px_64px_-20px_rgba(0,0,0,0.55)] dark:shadow-[0_30px_70px_-20px_rgba(0,0,0,0.72)] sm:rounded-b-[3.5rem] lg:rounded-b-[4.5rem]">
        <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-32 sm:px-6 sm:pt-40 lg:px-8">
          <div className="mb-14 text-center">
            <h1 className="text-4xl font-black tracking-tight text-brand-dark dark:text-brand-white sm:text-5xl">
              {t('home.pricing.pageTitle')}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-app-text-secondary sm:text-base">
              {t('home.pricing.pageSubtitle')}
            </p>
          </div>

          <TableBlock
            title={t('home.pricing.eventsTitle')}
            subtitle={t('home.pricing.eventsSubtitle')}
            table={EVENTS_TABLE}
          />
          <TableBlock
            title={t('home.pricing.sharingTitle')}
            subtitle={t('home.pricing.sharingSubtitle')}
            table={SHARING_TABLE}
          />

          <p className="mt-2 text-center text-xs text-app-text-muted">
            {t('home.pricing.footnote')}
          </p>
          <div className="mt-10 text-center">
            <HeroLink href="/" variant="outline" size="sm">
              ← {t('home.pricing.backHome')}
            </HeroLink>
          </div>
        </div>
      </div>

      <div aria-hidden className="h-100 sm:h-96 lg:h-104" />
    </div>
  );
};
