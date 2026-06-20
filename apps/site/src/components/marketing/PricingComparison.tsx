import { Fragment } from 'react';

import { useI18n } from '../../lib/i18n';

type Cell = boolean | string;

type Row = { label: string; cells: Cell[] };

type Section = { label: string; rows: Row[] };

export type PricingTable = {
  planKeys: string[];
  recommendedIndex: number;
  sections: Section[];
};

const Included = () => (
  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-lime">
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
    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-app-border text-xs text-app-text-muted"
    aria-hidden="true"
  >
    ×
  </span>
);

export const PricingComparison = ({ table }: { table: PricingTable }) => {
  const { t } = useI18n();
  const cols = table.planKeys.length;
  const isRecommended = (i: number) => i === table.recommendedIndex;

  return (
    <>
      <div className="grid gap-4 lg:hidden">
        {table.planKeys.map((planKey, i) => (
          <section
            key={planKey}
            className={`rounded-3xl border p-5 ${
              isRecommended(i)
                ? 'border-brand-lime bg-brand-lime/10 shadow-soft-lift'
                : 'border-app-border bg-app-elevated dark:bg-app-card'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-black text-brand-dark dark:text-brand-white">
                  {t(`home.pricing.${planKey}.name`)}
                </p>
                <p className="mt-1 text-2xl font-black text-brand-dark dark:text-brand-white">
                  {t(`home.pricing.${planKey}.price`)}
                </p>
                <p className="text-xs text-app-text-muted">{t(`home.pricing.${planKey}.note`)}</p>
              </div>
              {isRecommended(i) ? (
                <span className="rounded-full bg-brand-lime px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-brand-dark">
                  {t('home.pricing.recommended')}
                </span>
              ) : null}
            </div>

            <div className="mt-5 space-y-5">
              {table.sections.map((section) => (
                <div key={section.label}>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-app-text-muted">
                    {t(`home.pricing.sec.${section.label}`)}
                  </p>
                  <div className="overflow-hidden rounded-2xl border border-app-border/80 bg-app-bg/55 dark:bg-app-bg/20">
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
                          {typeof row.cells[i] === 'boolean' ? (
                            row.cells[i] ? (
                              <Included />
                            ) : (
                              <Excluded />
                            )
                          ) : (
                            <span className="text-sm font-bold text-app-text-secondary">
                              {t(`home.pricing.val.${row.cells[i]}`)}
                            </span>
                          )}
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

      <div className="hidden overflow-x-auto pb-1 lg:block">
        <div
          className="grid min-w-[680px] items-stretch"
          style={{ gridTemplateColumns: `minmax(0,1.7fr) repeat(${cols}, minmax(0,1fr))` }}
        >
          {/* header */}
          <div className="flex items-end px-4 py-5 text-sm font-black text-app-text-muted">
            {t('home.pricing.featuresLabel')}
          </div>
          {table.planKeys.map((planKey, i) => (
            <div
              key={planKey}
              className={`px-4 py-5 text-center ${isRecommended(i) ? 'rounded-t-2xl bg-brand-lime/10' : ''}`}
            >
              <p className="text-base font-black text-brand-dark dark:text-brand-white">
                {t(`home.pricing.${planKey}.name`)}
              </p>
              <p className="mt-0.5 text-sm font-black text-brand-dark dark:text-brand-white">
                {t(`home.pricing.${planKey}.price`)}
              </p>
              <p className="text-[11px] text-app-text-muted">{t(`home.pricing.${planKey}.note`)}</p>
              {isRecommended(i) ? (
                <span className="mt-2 inline-block rounded-full bg-brand-lime px-2.5 py-0.5 text-[10px] font-black text-brand-dark">
                  {t('home.pricing.recommended')}
                </span>
              ) : null}
            </div>
          ))}

          {/* sections */}
          {table.sections.map((section) => (
            <Fragment key={section.label}>
              <div className="col-span-full px-4 pb-2 pt-7 text-[11px] font-black uppercase tracking-widest text-app-text-muted">
                {t(`home.pricing.sec.${section.label}`)}
              </div>
              {section.rows.map((row) => (
                <Fragment key={row.label}>
                  <div className="flex items-center border-t border-app-border px-4 py-3 text-sm text-brand-dark dark:text-brand-white">
                    {t(`home.pricing.row.${row.label}`)}
                  </div>
                  {row.cells.map((cell, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-center border-t border-app-border px-4 py-3 text-center text-sm ${
                        isRecommended(i) ? 'bg-brand-lime/10' : ''
                      }`}
                    >
                      {typeof cell === 'boolean' ? (
                        cell ? (
                          <Included />
                        ) : (
                          <Excluded />
                        )
                      ) : (
                        <span className="font-bold text-app-text-secondary">
                          {t(`home.pricing.val.${cell}`)}
                        </span>
                      )}
                    </div>
                  ))}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </>
  );
};
