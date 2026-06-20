import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

import { SegmentedToggle } from './SegmentedToggle';
import { buildAppUrl } from '../../lib/app-url';
import { useI18n } from '../../lib/i18n';
import { HeroLink } from '../ui/HeroLink';

type Tab = 'events' | 'sharing';

type PlanGroup = {
  /** Tab label key under `home.pricing.*`. */
  tabKey: string;
  /** i18n plan keys under `home.pricing.*`, left to right. */
  planKeys: string[];
  /** Index of the highlighted ("Most popular") plan. */
  recommendedIndex: number;
};

// Each plan already ships name / price / note / feat1..feat4 in the locale
// files. The teaser cards reuse those and surface the key promise points, while
// points; the full feature breakdown lives in the comparison tables on /pricing.
const GROUPS: Record<Tab, PlanGroup> = {
  events: {
    tabKey: 'home.pricing.tabEvents',
    planKeys: ['events.free', 'events.party', 'events.celebration'],
    recommendedIndex: 1,
  },
  sharing: {
    tabKey: 'home.pricing.tabSharing',
    planKeys: ['sharing.free', 'sharing.unlock', 'sharing.curators'],
    recommendedIndex: 1,
  },
};

const TABS: Tab[] = ['events', 'sharing'];

const FEATURE_KEYS = ['feat1', 'feat2', 'feat3', 'feat4'] as const;

const Check = () => (
  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-lime">
    <svg viewBox="0 0 20 20" className="h-2.5 w-2.5 text-brand-dark" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8.143 13.314 4.93 10.1l-1.072 1.072 4.285 4.285 9-9-1.072-1.071z"
      />
    </svg>
  </span>
);

const PlanCard = ({ planKey, recommended }: { planKey: string; recommended: boolean }) => {
  const { t } = useI18n();
  const base = `home.pricing.${planKey}`;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-5 text-left sm:p-6 ${
        recommended
          ? 'border-brand-lime bg-brand-lime/10 shadow-soft-lift'
          : 'border-app-border bg-app-elevated dark:bg-app-card'
      }`}
    >
      {recommended ? (
        <span className="absolute -top-2.5 left-5 inline-block rounded-full bg-brand-lime px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-brand-dark">
          {t('home.pricing.recommended')}
        </span>
      ) : null}

      <p className="text-sm font-black text-brand-dark dark:text-brand-white">
        {t(`${base}.name`)}
      </p>
      <p className="mt-1 text-2xl font-black text-brand-dark dark:text-brand-white">
        {t(`${base}.price`)}
      </p>
      <p className="text-[11px] text-app-text-muted">{t(`${base}.note`)}</p>

      <ul className="mt-4 flex flex-col gap-2">
        {FEATURE_KEYS.map((featKey) => (
          <li
            key={featKey}
            className="flex items-start gap-2 text-xs text-app-text-secondary sm:text-sm"
          >
            <Check />
            <span>{t(`${base}.${featKey}`)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 pt-1">
        <HeroLink
          href={buildAppUrl('/auth/register')}
          variant={recommended ? 'lime' : 'outline'}
          size="sm"
          className="w-full justify-center"
        >
          {t(`${base}.cta`)}
        </HeroLink>
      </div>
    </div>
  );
};

export const PricingTeaserCards = () => {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>('events');
  const group = GROUPS[activeTab];
  const options = TABS.map((tab) => ({
    value: tab,
    label: t(GROUPS[tab].tabKey),
    activeVariant: tab === 'events' ? ('lime' as const) : ('pink' as const),
  }));

  return (
    <div className="mt-2 flex w-full flex-col items-center gap-8">
      <SegmentedToggle
        value={activeTab}
        onChange={setActiveTab}
        options={options}
        layoutId="pricing-tab-pill"
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
          className="grid w-full gap-4 sm:grid-cols-3"
        >
          {group.planKeys.map((planKey, i) => (
            <PlanCard key={planKey} planKey={planKey} recommended={i === group.recommendedIndex} />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
