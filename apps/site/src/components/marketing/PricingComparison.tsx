import { Sticker } from '@synqit/ui';
import { Fragment } from 'react';

import { buildAppUrl } from '../../lib/app-url';
import { useI18n } from '../../lib/i18n';
import { HeroLink } from '../ui/HeroLink';

type Cell = boolean | string;

type Row = { label: string; cells: Cell[] };

type Section = { label: string; rows: Row[] };

export type PricingTable = {
  planKeys: string[];
  recommendedIndex: number;
  sections: Section[];
};

const Included = () => (
  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-app-text bg-brand-lime">
    <svg viewBox="0 0 20 20" className="h-3 w-3 text-brand-dark" aria-hidden="true">
      <path
        fill="currentColor"
        d="M8.143 13.314 4.93 10.1l-1.072 1.072 4.285 4.285 9-9-1.072-1.071z"
      />
    </svg>
    <span className="sr-only">Included</span>
  </span>
);

const Excluded = () => (
  <span
    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-app-border-strong text-xs text-app-text-muted"
    aria-hidden="true"
  >
    ×
  </span>
);

const CellValue = ({ cell }: { cell: Cell }) => {
  const { t } = useI18n();
  if (typeof cell === 'boolean') {
    return cell ? <Included /> : <Excluded />;
  }
  return (
    <span className="text-sm font-bold text-app-text-secondary">
      {t(`home.pricing.val.${cell}`)}
    </span>
  );
};

export const PricingComparison = ({ table }: { table: PricingTable }) => {
  const { t } = useI18n();
  const cols = table.planKeys.length;
  const isRecommended = (i: number) => i === table.recommendedIndex;
  const registerHref = buildAppUrl('/auth/register');

  return (
    <>
      {/* ── Mobile / tablet: one sticker card per plan ─────────────────── */}
      <div className="grid gap-6 pt-3 lg:hidden">
        {table.planKeys.map((planKey, i) => (
          <section
            key={planKey}
            className={`relative rounded-3xl border-2 border-app-text p-5 shadow-sticker sm:p-6 ${
              isRecommended(i) ? 'bg-brand-lime/10' : 'bg-app-elevated dark:bg-app-card'
            }`}
          >
            {isRecommended(i) ? (
              <Sticker tone="lime" tilt="rotate-2" className="absolute -top-3.5 right-5">
                {t('home.pricing.recommended')}
              </Sticker>
            ) : null}
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.14em] text-app-text-muted">
                  {t(`home.pricing.${planKey}.name`)}
                </p>
                <p className="mt-1 text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white">
                  {t(`home.pricing.${planKey}.price`)}
                </p>
                <p className="text-xs text-app-text-muted">{t(`home.pricing.${planKey}.note`)}</p>
              </div>
              <HeroLink
                href={registerHref}
                variant={isRecommended(i) ? 'lime' : 'outline'}
                size="sm"
              >
                {t(`home.pricing.${planKey}.cta`)}
              </HeroLink>
            </div>

            <div className="mt-5 space-y-5">
              {table.sections.map((section) => (
                <div key={section.label}>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-app-text-muted">
                    {t(`home.pricing.sec.${section.label}`)}
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-app-border bg-app-bg/70 dark:bg-app-bg/30">
                    {section.rows.map((row, rowIndex) => (
                      <div
                        key={row.label}
                        className={`flex items-center justify-between gap-4 px-4 py-3 ${
                          rowIndex > 0 ? 'border-t border-app-border' : ''
                        }`}
                      >
                        <span className="text-sm leading-relaxed text-brand-dark dark:text-brand-white">
                          {t(`home.pricing.row.${row.label}`)}
                        </span>
                        <span className="shrink-0">
                          <CellValue cell={row.cells[i]} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* ── Desktop: one comparison table in a sticker frame ───────────── */}
      <div className="hidden rounded-3xl border-2 border-app-text bg-app-elevated shadow-sticker dark:bg-app-card lg:block">
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[680px] items-stretch"
            style={{ gridTemplateColumns: `minmax(0,1.7fr) repeat(${cols}, minmax(0,1fr))` }}
          >
            {/* header */}
            <div className="flex items-end px-6 pb-6 pt-12 text-sm font-black text-app-text-muted">
              {t('home.pricing.featuresLabel')}
            </div>
            {table.planKeys.map((planKey, i) => (
              <div
                key={planKey}
                className={`relative px-4 pb-6 pt-12 text-center ${
                  isRecommended(i) ? 'bg-brand-lime/10' : ''
                }`}
              >
                {isRecommended(i) ? (
                  <Sticker
                    tone="lime"
                    tilt="rotate-2"
                    className="absolute left-1/2 top-3 -translate-x-1/2"
                  >
                    {t('home.pricing.recommended')}
                  </Sticker>
                ) : null}
                <p className="text-sm font-black uppercase tracking-[0.14em] text-app-text-muted">
                  {t(`home.pricing.${planKey}.name`)}
                </p>
                <p className="mt-1 text-3xl font-black tracking-tight text-brand-dark dark:text-brand-white">
                  {t(`home.pricing.${planKey}.price`)}
                </p>
                <p className="text-[11px] text-app-text-muted">
                  {t(`home.pricing.${planKey}.note`)}
                </p>
              </div>
            ))}

            {/* sections */}
            {table.sections.map((section) => (
              <Fragment key={section.label}>
                <div className="col-span-full border-t-2 border-app-text px-6 pb-2 pt-6 text-[11px] font-black uppercase tracking-widest text-app-text-muted">
                  {t(`home.pricing.sec.${section.label}`)}
                </div>
                {section.rows.map((row) => (
                  <Fragment key={row.label}>
                    <div className="flex items-center border-t border-app-border px-6 py-3 text-sm text-brand-dark dark:text-brand-white">
                      {t(`home.pricing.row.${row.label}`)}
                    </div>
                    {row.cells.map((cell, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-center border-t border-app-border px-4 py-3 text-center ${
                          isRecommended(i) ? 'bg-brand-lime/10' : ''
                        }`}
                      >
                        <CellValue cell={cell} />
                      </div>
                    ))}
                  </Fragment>
                ))}
              </Fragment>
            ))}

            {/* plan CTAs */}
            <div className="border-t-2 border-app-text" />
            {table.planKeys.map((planKey, i) => (
              <div
                key={planKey}
                className={`flex items-center justify-center border-t-2 border-app-text px-4 py-6 ${
                  isRecommended(i) ? 'rounded-b-3xl bg-brand-lime/10' : ''
                }`}
              >
                <HeroLink
                  href={registerHref}
                  variant={isRecommended(i) ? 'lime' : 'outline'}
                  size="sm"
                >
                  {t(`home.pricing.${planKey}.cta`)}
                </HeroLink>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
